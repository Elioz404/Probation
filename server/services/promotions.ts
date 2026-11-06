import { randomUUID } from "node:crypto";

import { fail } from "@agent-native/core/action";
import { defineMachine } from "@agent-native/core/state-machine";
import { and, desc, eq, inArray } from "drizzle-orm";

import {
  promotionEvidenceSchema,
  type PromotionEvidence,
  type PromotionView,
} from "../../shared/contracts.js";
import {
  isHigherLevel,
  levelRank,
  type CellKey,
  type IssueContext,
  type TriageAction,
  type TrustLevel,
  trustLevelSchema,
} from "../../shared/trust/model.js";
import { getDb, schema } from "../db/index.js";
import { policyOf, type ProbationRow } from "./probations.js";
import { changeLevel, grantedLevelOf, loadCell } from "./trust-map.js";

const { promotionRequests } = schema;

const promotionMachine = defineMachine({
  id: "promotion-request",
  states: ["pending", "signed", "declined"],
  initial: "pending",
  terminal: ["signed", "declined"],
  transitions: {
    sign: { from: ["pending"], to: "signed" },
    decline: { from: ["pending"], to: "declined" },
  },
});

export async function listPromotions(
  probationId: string,
): Promise<PromotionView[]> {
  const rows = await getDb()
    .select()
    .from(promotionRequests)
    .where(eq(promotionRequests.probationId, probationId))
    .orderBy(desc(promotionRequests.createdAt));
  return Promise.all(
    rows.map(async (row) => {
      const key = {
        action: row.action as TriageAction,
        context: row.context as IssueContext,
      };
      return {
        id: row.id,
        ...key,
        fromLevel: await grantedLevelOf(probationId, key),
        toLevel: trustLevelSchema.parse(row.toLevel),
        argument: row.argument,
        evidence: promotionEvidenceSchema.parse(JSON.parse(row.evidence)),
        status: promotionMachine.parseState(row.status),
        createdAt: row.createdAt,
      };
    }),
  );
}

function evidenceFor(
  cell: Awaited<ReturnType<typeof loadCell>>,
  bar: number,
): PromotionEvidence {
  return {
    cases: cell.aggregate.cases,
    accuracy: cell.accuracy,
    defensibleAccuracy: cell.defensibleAccuracy,
    effectiveSamples: cell.effectiveSamples,
    bar,
  };
}

export interface PromotionInput extends CellKey {
  toLevel: Exclude<TrustLevel, "observe">;
  argument: string;
}

/**
 * The agent may argue for autonomy but not vouch for its own numbers: the
 * evidence is computed here, and a request the evidence cannot support is
 * refused before a person ever sees it.
 */
export async function requestPromotion(
  probation: ProbationRow,
  input: PromotionInput,
): Promise<string> {
  const { action, context, toLevel, argument } = input;
  const key = { action, context };
  const cell = await loadCell(probation, key);
  if (!isHigherLevel(toLevel, cell.granted)) {
    fail(`This cell already holds ${cell.granted}.`, {
      errorCode: "already_granted",
      statusCode: 409,
    });
  }
  if (levelRank(cell.earned) < levelRank(toLevel)) {
    fail(
      `The evidence only supports ${cell.earned} for this cell: ${cell.aggregate.cases} graded cases, defensible accuracy ${cell.defensibleAccuracy.toFixed(2)}.`,
      { errorCode: "not_earned", statusCode: 409 },
    );
  }
  const id = randomUUID();
  const bar = policyOf(probation).bars[action][toLevel];
  const inserted = await getDb()
    .insert(promotionRequests)
    .values({
      id,
      probationId: probation.id,
      ...key,
      toLevel,
      argument,
      evidence: JSON.stringify(evidenceFor(cell, bar)),
      status: promotionMachine.initial,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .returning({ id: promotionRequests.id });
  if (inserted.length === 0) {
    fail("A request for this cell is already waiting for a signature.", {
      errorCode: "already_pending",
      statusCode: 409,
    });
  }
  return id;
}

async function settle(
  probationId: string,
  requestId: string,
  event: "sign" | "decline",
) {
  const [row] = await getDb()
    .update(promotionRequests)
    .set({
      status: promotionMachine.transition("pending", event),
      decidedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(promotionRequests.id, requestId),
        eq(promotionRequests.probationId, probationId),
        inArray(promotionRequests.status, [
          ...promotionMachine.fromStates(event),
        ]),
      ),
    )
    .returning();
  if (!row) {
    fail("This request was already decided.", {
      errorCode: "already_decided",
      statusCode: 409,
    });
  }
  return row;
}

export async function declinePromotion(
  probation: ProbationRow,
  requestId: string,
): Promise<void> {
  await settle(probation.id, requestId, "decline");
}

/** Evidence is checked again: it can have changed since the request was filed. */
export async function signPromotion(
  probation: ProbationRow,
  requestId: string,
): Promise<TrustLevel> {
  const [pending] = await getDb()
    .select()
    .from(promotionRequests)
    .where(
      and(
        eq(promotionRequests.id, requestId),
        eq(promotionRequests.probationId, probation.id),
      ),
    )
    .limit(1);
  if (!pending) {
    fail("Promotion request not found.", {
      errorCode: "not_found",
      statusCode: 404,
    });
  }
  const key = {
    action: pending.action as TriageAction,
    context: pending.context as IssueContext,
  };
  const toLevel = trustLevelSchema.parse(pending.toLevel);
  const cell = await loadCell(probation, key);
  if (levelRank(cell.earned) < levelRank(toLevel)) {
    fail(
      "The evidence changed and no longer supports this promotion. Decline it.",
      { errorCode: "evidence_changed", statusCode: 409 },
    );
  }
  const row = await settle(probation.id, requestId, "sign");
  return changeLevel({
    probationId: probation.id,
    key,
    toLevel,
    kind: "promotion",
    actor: "human",
    reason: row.argument,
  });
}
