import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { loadProbation } from "../server/services/probations.js";
import { proposeTriage } from "../server/services/work.js";
import { probationIdSchema, workItemSchema } from "../shared/contracts.js";
import { dispositionSchema } from "../shared/trust/model.js";

export default defineAction({
  description:
    "Record your triage call on a work item. Touches nothing on GitHub. Then call execute-triage: the trust map decides whether it runs, waits for a person, or stays a suggestion.",
  mcpTool: true,
  schema: z.object({
    probationId: probationIdSchema,
    workItemId: z.string().min(1).max(64),
    disposition: dispositionSchema.describe(
      '"accept", "close-duplicate" or "close-not-planned".',
    ),
    labels: z
      .array(z.string().max(100))
      .max(10)
      .describe(
        "Labels to apply, from labelCatalog in read-work-issue. Unknown labels are refused. Empty when none fit.",
      ),
    confidence: z.number().min(0).max(1).describe("From 0 to 1."),
    rationale: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .describe("One sentence a maintainer could check."),
  }),
  outputSchema: z.object({
    item: workItemSchema,
    nextRequiredAction: z.string(),
  }),
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  run: async ({ probationId, ...proposal }) => ({
    item: await proposeTriage(
      await loadProbation(probationId, "editor"),
      proposal,
    ),
    nextRequiredAction: "execute-triage",
  }),
});
