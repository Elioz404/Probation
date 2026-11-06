import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { submitExamAnswers } from "../server/services/exam.js";
import { loadProbation } from "../server/services/probations.js";
import { probationIdSchema } from "../shared/contracts.js";
import { dispositionSchema } from "../shared/trust/model.js";

const MAX_ANSWERS = 25;

export default defineAction({
  description:
    "Submit exam answers. Each case can be answered once and is graded in code against the hidden answer key. Returns progress only, never the grades.",
  schema: z.object({
    probationId: probationIdSchema,
    answers: z
      .array(
        z.object({
          caseId: z
            .string()
            .min(1)
            .max(64)
            .describe("From get-exam-questions."),
          disposition: dispositionSchema.describe(
            'Your call: "accept" (real work), "close-duplicate" or "close-not-planned".',
          ),
          labels: z
            .array(z.string().max(100))
            .max(10)
            .describe(
              "Labels you would apply, from the catalog. Empty when none fit.",
            ),
          confidence: z.number().min(0).max(1).describe("From 0 to 1."),
          rationale: z
            .string()
            .min(1)
            .max(500)
            .describe("One sentence a maintainer could check."),
        }),
      )
      .min(1)
      .max(MAX_ANSWERS),
  }),
  outputSchema: z.object({
    accepted: z.number(),
    answered: z.number(),
    remaining: z.number(),
    nextRequiredAction: z.string().optional(),
  }),
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  run: async ({ probationId, answers }) => {
    const probation = await loadProbation(probationId, "editor");
    const progress = await submitExamAnswers(probation, answers);
    return {
      ...progress,
      ...(progress.remaining > 0
        ? { nextRequiredAction: "get-exam-questions" }
        : {}),
    };
  },
});
