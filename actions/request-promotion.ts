import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { loadProbation } from "../server/services/probations.js";
import { requestPromotion } from "../server/services/promotions.js";
import { probationIdSchema } from "../shared/contracts.js";
import {
  issueContextSchema,
  triageActionSchema,
} from "../shared/trust/model.js";

export default defineAction({
  description:
    "Ask a person for more autonomy on one trust-map cell. Refused unless the evidence already supports the level; the person signs or declines in the app.",
  schema: z.object({
    probationId: probationIdSchema,
    action: triageActionSchema,
    context: issueContextSchema,
    toLevel: z
      .enum(["ask", "solo"])
      .describe('Level requested: "ask" or "solo".'),
    argument: z
      .string()
      .trim()
      .min(1)
      .max(800)
      .describe(
        "Your case in two sentences, including what you got wrong. Numbers are attached for you.",
      ),
  }),
  outputSchema: z.object({ id: z.string(), message: z.string() }),
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
  },
  run: async ({ probationId, ...input }) => ({
    id: await requestPromotion(
      await loadProbation(probationId, "editor"),
      input,
    ),
    message: "Filed. A person has to sign it in the app.",
  }),
});
