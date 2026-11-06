import { z } from "zod";

/** How much rope a cell of the trust map gives the agent. Ordered low to high. */
export const TRUST_LEVELS = ["observe", "ask", "solo"] as const;
export type TrustLevel = (typeof TRUST_LEVELS)[number];
export const trustLevelSchema = z.enum(TRUST_LEVELS);

export function levelRank(level: TrustLevel): number {
  return TRUST_LEVELS.indexOf(level);
}

export function isHigherLevel(a: TrustLevel, b: TrustLevel): boolean {
  return levelRank(a) > levelRank(b);
}

/** One step down, floored at `observe`. */
export function demotedLevel(level: TrustLevel): TrustLevel {
  return TRUST_LEVELS[Math.max(0, levelRank(level) - 1)]!;
}

/** The final call on an issue. Exactly one per issue. */
export const DISPOSITIONS = [
  "accept",
  "close-duplicate",
  "close-not-planned",
] as const;
export type Disposition = (typeof DISPOSITIONS)[number];
export const dispositionSchema = z.enum(DISPOSITIONS);

/** Rows of the trust map: every kind of decision that can earn autonomy. */
export const TRIAGE_ACTIONS = [...DISPOSITIONS, "apply-labels"] as const;
export type TriageAction = (typeof TRIAGE_ACTIONS)[number];
export const triageActionSchema = z.enum(TRIAGE_ACTIONS);

/** Columns of the trust map: who reported the issue and how much they wrote. */
export const ISSUE_CONTEXTS = [
  "newcomer-thin",
  "newcomer-detailed",
  "regular-thin",
  "regular-detailed",
] as const;
export type IssueContext = (typeof ISSUE_CONTEXTS)[number];
export const issueContextSchema = z.enum(ISSUE_CONTEXTS);

/** Who changed a level or wrote a record. Identity lives in the audit log. */
export const ACTORS = ["agent", "human", "system"] as const;
export type Actor = (typeof ACTORS)[number];
export const actorSchema = z.enum(ACTORS);

export interface CellKey {
  action: TriageAction;
  context: IssueContext;
}

export function cellKeyOf({ action, context }: CellKey): string {
  return `${action}::${context}`;
}

export function allCellKeys(): CellKey[] {
  return TRIAGE_ACTIONS.flatMap((action) =>
    ISSUE_CONTEXTS.map((context) => ({ action, context })),
  );
}
