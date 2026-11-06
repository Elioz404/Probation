import { randomUUID } from "node:crypto";

import { and, desc, eq, isNotNull } from "drizzle-orm";

import type {
  TRUST_EVENT_KINDS,
  TrustCellView,
} from "../../shared/contracts.js";
import {
  allCellKeys,
  cellKeyOf,
  demotedLevel,
  type Actor,
  type CellKey,
  type Disposition,
  type IssueContext,
  type TriageAction,
  type TrustLevel,
  trustLevelSchema,
} from "../../shared/trust/model.js";
import type { TrustPolicy } from "../../shared/trust/policy.js";
import {
  accuracyOf,
  aggregateGrades,
  defensibleAccuracy,
  earnedLevel,
  effectiveSamples,
  emptyAggregate,
  type GradedCell,
} from "../../shared/trust/stats.js";
import { getDb, schema } from "../db/index.js";
import { policyOf, type ProbationRow } from "./probations.js";

const { examCases, trustCells, trustEvents } = schema;

type TrustEventKind = (typeof TRUST_EVENT_KINDS)[number];

/** Graded rows become one disposition grade and, when graded, one label grade. */
export function gradesOfCase(row: {
  context: string;
  weight: number;
  answerDisposition: string | null;
  dispositionCorrect: boolean | null;
  labelsCorrect: boolean | null;
}): GradedCell[] {
  if (row.answerDisposition === null || row.dispositionCorrect === null) {
    return [];
  }
  const context = row.context as IssueContext;
  const grades: GradedCell[] = [
    {
      action: row.answerDisposition as Disposition,
      context,
      correct: row.dispositionCorrect,
      weight: row.weight,
    },
  ];
  if (row.labelsCorrect !== null) {
    grades.push({
      action: "apply-labels",
      context,
      correct: row.labelsCorrect,
      weight: row.weight,
    });
  }
  return grades;
}

async function loadAggregates(probationId: string) {
  const rows = await getDb()
    .select({
      context: examCases.context,
      weight: examCases.weight,
      answerDisposition: examCases.answerDisposition,
      dispositionCorrect: examCases.dispositionCorrect,
      labelsCorrect: examCases.labelsCorrect,
    })
    .from(examCases)
    .where(
      and(
        eq(examCases.probationId, probationId),
        eq(examCases.contested, false),
        isNotNull(examCases.answeredAt),
      ),
    );
  return aggregateGrades(rows.flatMap(gradesOfCase));
}

async function loadGrantedLevels(probationId: string) {
  const rows = await getDb()
    .select()
    .from(trustCells)
    .where(eq(trustCells.probationId, probationId));
  return new Map(
    rows.map((row) => [
      cellKeyOf({
        action: row.action as TriageAction,
        context: row.context as IssueContext,
      }),
      trustLevelSchema.parse(row.level),
    ]),
  );
}

export async function loadTrustCells(
  probationId: string,
  policy: TrustPolicy,
): Promise<TrustCellView[]> {
  const [aggregates, granted] = await Promise.all([
    loadAggregates(probationId),
    loadGrantedLevels(probationId),
  ]);
  return allCellKeys().map((key) => {
    const aggregate = aggregates.get(cellKeyOf(key)) ?? emptyAggregate();
    return {
      ...key,
      granted: granted.get(cellKeyOf(key)) ?? "observe",
      earned: earnedLevel(aggregate, key.action, policy),
      aggregate,
      accuracy: accuracyOf(aggregate),
      defensibleAccuracy: defensibleAccuracy(aggregate),
      effectiveSamples: effectiveSamples(aggregate),
    };
  });
}

export async function loadCell(
  probation: ProbationRow,
  key: CellKey,
): Promise<TrustCellView> {
  const cells = await loadTrustCells(probation.id, policyOf(probation));
  return cells.find(
    (cell) => cell.action === key.action && cell.context === key.context,
  )!;
}

export async function grantedLevelOf(
  probationId: string,
  key: CellKey,
): Promise<TrustLevel> {
  const [row] = await getDb()
    .select({ level: trustCells.level })
    .from(trustCells)
    .where(
      and(
        eq(trustCells.probationId, probationId),
        eq(trustCells.action, key.action),
        eq(trustCells.context, key.context),
      ),
    )
    .limit(1);
  return row ? trustLevelSchema.parse(row.level) : "observe";
}

export interface LevelChange {
  probationId: string;
  key: CellKey;
  toLevel: TrustLevel;
  kind: TrustEventKind;
  actor: Actor;
  reason: string;
}

/** The single write path for a granted level; each change leaves an event. */
export async function changeLevel(change: LevelChange): Promise<TrustLevel> {
  const { probationId, key, toLevel, kind, actor, reason } = change;
  const fromLevel = await grantedLevelOf(probationId, key);
  if (fromLevel === toLevel) return toLevel;
  const now = new Date().toISOString();
  const db = getDb();
  await db
    .insert(trustCells)
    .values({ probationId, ...key, level: toLevel, updatedAt: now })
    .onConflictDoUpdate({
      target: [trustCells.probationId, trustCells.action, trustCells.context],
      set: { level: toLevel, updatedAt: now },
    });
  await db.insert(trustEvents).values({
    id: randomUUID(),
    probationId,
    ...key,
    fromLevel,
    toLevel,
    kind,
    actor,
    reason,
    createdAt: now,
  });
  return toLevel;
}

export async function demoteCell(
  probationId: string,
  key: CellKey,
  reason: string,
): Promise<TrustLevel> {
  const current = await grantedLevelOf(probationId, key);
  return changeLevel({
    probationId,
    key,
    toLevel: demotedLevel(current),
    kind: "demotion",
    actor: "human",
    reason,
  });
}

export async function listTrustEvents(probationId: string) {
  const rows = await getDb()
    .select()
    .from(trustEvents)
    .where(eq(trustEvents.probationId, probationId))
    .orderBy(desc(trustEvents.createdAt));
  return rows.map((row) => ({
    id: row.id,
    action: row.action as TriageAction,
    context: row.context as IssueContext,
    fromLevel: trustLevelSchema.parse(row.fromLevel),
    toLevel: trustLevelSchema.parse(row.toLevel),
    kind: row.kind as TrustEventKind,
    actor: row.actor as Actor,
    reason: row.reason,
    createdAt: row.createdAt,
  }));
}
