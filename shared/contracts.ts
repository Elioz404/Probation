import { z } from "zod";

import {
  actorSchema,
  dispositionSchema,
  issueContextSchema,
  triageActionSchema,
  trustLevelSchema,
} from "./trust/model";
import { trustPolicySchema } from "./trust/policy";

/** Wire contracts shared by actions and the UI. */

export const probationIdSchema = z
  .string()
  .min(1)
  .max(64)
  .describe("Probation id, from list-probations or the current screen.");

export const probationSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  examRepo: z.string(),
  workRepo: z.string().nullable(),
  examTotal: z.number(),
  examAnswered: z.number(),
  createdAt: z.string(),
});

export const probationDetailSchema = probationSummarySchema.extend({
  policy: trustPolicySchema,
  triagedLabel: z.string(),
  labelCatalog: z.array(z.string()),
  /** Null until the exam has been imported. */
  acceptEverythingBaseline: z.number().nullable(),
});

export const cellAggregateSchema = z.object({
  cases: z.number(),
  weightedCorrect: z.number(),
  weightedTotal: z.number(),
  sumSquaredWeights: z.number(),
});

export const trustCellSchema = z.object({
  action: triageActionSchema,
  context: issueContextSchema,
  granted: trustLevelSchema,
  earned: trustLevelSchema,
  aggregate: cellAggregateSchema,
  accuracy: z.number().nullable(),
  defensibleAccuracy: z.number(),
  effectiveSamples: z.number(),
});

export type TrustCellView = z.infer<typeof trustCellSchema>;

export const promotionEvidenceSchema = z.object({
  cases: z.number(),
  accuracy: z.number().nullable(),
  defensibleAccuracy: z.number(),
  effectiveSamples: z.number(),
  bar: z.number(),
});

export type PromotionEvidence = z.infer<typeof promotionEvidenceSchema>;

export const PROMOTION_STATUSES = ["pending", "signed", "declined"] as const;

export const promotionSchema = z.object({
  id: z.string(),
  action: triageActionSchema,
  context: issueContextSchema,
  fromLevel: trustLevelSchema,
  toLevel: trustLevelSchema,
  argument: z.string(),
  evidence: promotionEvidenceSchema,
  status: z.enum(PROMOTION_STATUSES),
  createdAt: z.string(),
});

export type PromotionView = z.infer<typeof promotionSchema>;

export const simulationSchema = z.object({
  gradedCases: z.number(),
  solvedAlonePer100: z.number(),
  wrongAlonePer100: z.number(),
  askedPer100: z.number(),
  watchedPer100: z.number(),
});

export const trustMapSchema = z.object({
  cells: z.array(trustCellSchema),
  promotions: z.array(promotionSchema),
  simulation: simulationSchema,
});

export const TRUST_EVENT_KINDS = ["promotion", "demotion", "manual"] as const;

export const trustEventSchema = z.object({
  id: z.string(),
  action: triageActionSchema,
  context: issueContextSchema,
  fromLevel: trustLevelSchema,
  toLevel: trustLevelSchema,
  kind: z.enum(TRUST_EVENT_KINDS),
  actor: actorSchema,
  reason: z.string(),
  createdAt: z.string(),
});

export const examQuestionSchema = z.object({
  caseId: z.string(),
  context: issueContextSchema,
  untrustedIssueTitle: z.string(),
  untrustedIssueBody: z.string(),
});

export const examResultSchema = z.object({
  caseId: z.string(),
  source: z.string(),
  issueNumber: z.number(),
  issueUrl: z.string(),
  title: z.string(),
  context: issueContextSchema,
  answerDisposition: dispositionSchema,
  answerLabels: z.array(z.string()),
  answerRationale: z.string(),
  truthDisposition: dispositionSchema,
  truthLabels: z.array(z.string()),
  dispositionCorrect: z.boolean(),
  labelsCorrect: z.boolean().nullable(),
  contested: z.boolean(),
});

export const WORK_ITEM_STATUSES = [
  "new",
  "proposed",
  "executed",
  "overruled",
] as const;

export const workItemSchema = z.object({
  id: z.string(),
  issueNumber: z.number(),
  issueUrl: z.string(),
  title: z.string(),
  context: issueContextSchema,
  status: z.enum(WORK_ITEM_STATUSES),
  proposedDisposition: dispositionSchema.nullable(),
  proposedLabels: z.array(z.string()),
  proposedConfidence: z.number().nullable(),
  proposedRationale: z.string().nullable(),
  /** Autonomy the current map gives this proposal; null before one exists. */
  currentLevel: trustLevelSchema.nullable(),
  executedAtLevel: trustLevelSchema.nullable(),
  executedBy: actorSchema.nullable(),
  overruleNote: z.string().nullable(),
  createdAt: z.string(),
});

export type WorkItemView = z.infer<typeof workItemSchema>;
