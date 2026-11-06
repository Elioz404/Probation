import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { withGitHubErrors } from "../server/github/action-errors.js";
import { gitHubReader } from "../server/github/credentials.js";
import { importExam } from "../server/services/exam.js";
import { loadProbation } from "../server/services/probations.js";
import { probationIdSchema } from "../shared/contracts.js";

const DEFAULT_QUESTIONS_PER_OUTCOME = 20;
const MAX_QUESTIONS_PER_OUTCOME = 100;

export default defineAction({
  description:
    "Build the exam from the repository's closed issues. Only issues closed by a person other than the reporter count. Each real outcome becomes the answer key, which the examinee never sees. Safe to run again: known issues are skipped.",
  // An external agent brings its own web tools, so it could not sit a blind exam.
  mcpTool: false,
  schema: z.object({
    probationId: probationIdSchema,
    questionsPerOutcome: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_QUESTIONS_PER_OUTCOME)
      .default(DEFAULT_QUESTIONS_PER_OUTCOME)
      .describe(
        `Project decisions to sample per outcome (completed, duplicate, not planned); defaults to ${DEFAULT_QUESTIONS_PER_OUTCOME}.`,
      ),
  }),
  outputSchema: z.object({
    imported: z.number(),
    nextRequiredAction: z.string(),
  }),
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  run: async ({ probationId, questionsPerOutcome }) => {
    const probation = await loadProbation(probationId, "editor");
    const { imported } = await withGitHubErrors(async () =>
      importExam(probation, await gitHubReader(), questionsPerOutcome),
    );
    return { imported, nextRequiredAction: "get-exam-questions" };
  },
});
