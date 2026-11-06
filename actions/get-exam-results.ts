import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getExamResults } from "../server/services/exam.js";
import { loadReadableProbation } from "../server/services/probations.js";
import { examResultSchema, probationIdSchema } from "../shared/contracts.js";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export default defineAction({
  description:
    "Read graded answers next to how each issue was really closed. Agents can read this only once the exam has ended.",
  // An external agent brings its own web tools, so it could not sit a blind exam.
  mcpTool: false,
  schema: z.object({
    probationId: probationIdSchema,
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_LIMIT)
      .default(DEFAULT_LIMIT)
      .describe(
        `Results to return, latest first; defaults to ${DEFAULT_LIMIT}.`,
      ),
  }),
  outputSchema: z.array(examResultSchema),
  http: { method: "GET" },
  run: async ({ probationId, limit }, ctx) =>
    getExamResults(await loadReadableProbation(probationId), {
      callerIsHuman: ctx?.caller === "frontend",
      limit,
    }),
});
