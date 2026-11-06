import { z } from "zod";

import { TRIAGE_ACTIONS, type TriageAction } from "./model";

const shareSchema = z.number().min(0).max(1);

const barSchema = z
  .object({
    ask: shareSchema.describe(
      "Lowest confidence-adjusted accuracy that earns Ask, from 0 to 1.",
    ),
    solo: shareSchema.describe(
      "Lowest confidence-adjusted accuracy that earns Solo, from 0 to 1.",
    ),
  })
  .refine((bar) => bar.ask <= bar.solo, {
    message: "The Ask bar cannot be above the Solo bar.",
  });

export type TrustBar = z.infer<typeof barSchema>;

const barsShape = Object.fromEntries(
  TRIAGE_ACTIONS.map((action) => [action, barSchema]),
) as Record<TriageAction, typeof barSchema>;

export const trustPolicySchema = z.object({
  minSamples: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .describe(
      "Effective graded cases a cell needs before it can earn a level.",
    ),
  overrulePenalty: z
    .number()
    .min(1)
    .max(100)
    .describe("How many ordinary wrong answers one human overrule counts as."),
  bars: z.object(barsShape),
});

export type TrustPolicy = z.infer<typeof trustPolicySchema>;

/**
 * Starting bars for a new probation. They follow the cost of a mistake: a wrong
 * label is a nuisance, a wrongly closed issue turns a contributor away. People
 * can move them per probation; these only decide where the sliders start.
 */
export const DEFAULT_TRUST_POLICY: TrustPolicy = {
  minSamples: 5,
  overrulePenalty: 5,
  bars: {
    "apply-labels": { ask: 0.4, solo: 0.7 },
    accept: { ask: 0.5, solo: 0.8 },
    "close-duplicate": { ask: 0.6, solo: 0.9 },
    "close-not-planned": { ask: 0.65, solo: 0.92 },
  },
};
