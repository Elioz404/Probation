import { randomUUID } from "node:crypto";

import { fail } from "@agent-native/core/action";
import {
  getRequestOrgId,
  getRequestUserEmail,
} from "@agent-native/core/server";
import { accessFilter, assertAccess } from "@agent-native/core/sharing";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { DISPOSITIONS, type Disposition } from "../../shared/trust/model.js";
import {
  DEFAULT_TRUST_POLICY,
  trustPolicySchema,
  type TrustPolicy,
} from "../../shared/trust/policy.js";
import { acceptEverythingBaseline } from "../../shared/trust/simulate.js";
import { getDb, PROBATION_RESOURCE, schema } from "../db/index.js";

const { examCases, probations, probationShares } = schema;

export type ProbationRow = typeof probations.$inferSelect;
type AccessRole = "viewer" | "editor";

const populationsSchema = z.object(
  Object.fromEntries(DISPOSITIONS.map((d) => [d, z.number()])) as Record<
    Disposition,
    z.ZodNumber
  >,
);

const stringListSchema = z.array(z.string());

export function parseStringList(value: string | null): string[] {
  return value === null ? [] : stringListSchema.parse(JSON.parse(value));
}

export function policyOf(row: ProbationRow): TrustPolicy {
  return trustPolicySchema.parse(JSON.parse(row.policy));
}

function baselineOf(row: ProbationRow): number | null {
  return row.populations === null
    ? null
    : acceptEverythingBaseline(
        populationsSchema.parse(JSON.parse(row.populations)),
      );
}

/** Row-level gate every service call goes through before touching children. */
export async function loadProbation(
  id: string,
  role: AccessRole,
): Promise<ProbationRow> {
  await assertAccess(PROBATION_RESOURCE, id, role);
  const [row] = await getDb()
    .select()
    .from(probations)
    .where(eq(probations.id, id))
    .limit(1);
  if (!row) {
    fail("Probation not found.", { errorCode: "not_found", statusCode: 404 });
  }
  return row;
}

export async function loadReadableProbation(id: string): Promise<ProbationRow> {
  return loadProbation(id, "viewer");
}

export interface NewProbation {
  examRepo: string;
  workRepo: string | null;
  triagedLabel: string;
}

export async function createProbation(input: NewProbation): Promise<string> {
  const ownerEmail = getRequestUserEmail();
  if (!ownerEmail) {
    fail("Sign in to start a probation.", {
      errorCode: "unauthenticated",
      statusCode: 401,
    });
  }
  const id = randomUUID();
  const now = new Date().toISOString();
  await getDb()
    .insert(probations)
    .values({
      id,
      title: input.examRepo,
      examRepo: input.examRepo,
      workRepo: input.workRepo,
      triagedLabel: input.triagedLabel,
      policy: JSON.stringify(DEFAULT_TRUST_POLICY),
      createdAt: now,
      updatedAt: now,
      ownerEmail,
      orgId: getRequestOrgId() ?? null,
    });
  return id;
}

async function examProgress(ids: string[]) {
  if (ids.length === 0) return new Map<string, [number, number]>();
  const rows = await getDb()
    .select({
      probationId: examCases.probationId,
      total: count(),
      answered: count(examCases.answeredAt),
    })
    .from(examCases)
    .where(
      and(inArray(examCases.probationId, ids), eq(examCases.source, "history")),
    )
    .groupBy(examCases.probationId);
  return new Map(
    rows.map((row) => [row.probationId, [row.total, row.answered]] as const),
  );
}

function summaryOf(row: ProbationRow, progress: readonly [number, number]) {
  return {
    id: row.id,
    title: row.title,
    examRepo: row.examRepo,
    workRepo: row.workRepo,
    examTotal: progress[0],
    examAnswered: progress[1],
    createdAt: row.createdAt,
  };
}

export async function listProbations() {
  const rows = await getDb()
    .select()
    .from(probations)
    .where(accessFilter(probations, probationShares))
    .orderBy(desc(probations.createdAt));
  const progress = await examProgress(rows.map((row) => row.id));
  return rows.map((row) => summaryOf(row, progress.get(row.id) ?? [0, 0]));
}

export async function getProbationDetail(id: string) {
  const row = await loadReadableProbation(id);
  const progress = await examProgress([id]);
  return {
    ...summaryOf(row, progress.get(id) ?? [0, 0]),
    policy: policyOf(row),
    triagedLabel: row.triagedLabel,
    labelCatalog: parseStringList(row.labelCatalog),
    acceptEverythingBaseline: baselineOf(row),
  };
}

export async function updatePolicy(
  id: string,
  policy: TrustPolicy,
): Promise<void> {
  await loadProbation(id, "editor");
  await getDb()
    .update(probations)
    .set({
      policy: JSON.stringify(policy),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(probations.id, id));
}

export async function recordExamImport(
  id: string,
  populations: Record<Disposition, number>,
  labelCatalog: readonly string[],
): Promise<void> {
  await getDb()
    .update(probations)
    .set({
      populations: JSON.stringify(populations),
      labelCatalog: JSON.stringify(labelCatalog),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(probations.id, id));
}
