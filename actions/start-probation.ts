import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { createProbation } from "../server/services/probations.js";
import { repoRefSchema } from "../shared/github/repo-ref.js";
import { probationPath } from "../shared/navigation.js";

const DEFAULT_TRIAGED_LABEL = "triaged";

export default defineAction({
  description:
    "Open a probation: an agent examined on one repository's closed issues, optionally working on a second repository afterwards.",
  schema: z.object({
    examRepo: repoRefSchema.describe(
      'Repository whose closed issues become the exam: "owner/name" or a GitHub URL. Read only.',
    ),
    workRepo: repoRefSchema
      .optional()
      .describe(
        "Repository the agent may act on once it earns autonomy. Omit to run the exam only.",
      ),
    triagedLabel: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .default(DEFAULT_TRIAGED_LABEL)
      .describe(
        `Label that marks an accepted issue on the work repository; defaults to "${DEFAULT_TRIAGED_LABEL}".`,
      ),
  }),
  outputSchema: z.object({ id: z.string(), urlPath: z.string() }),
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: false,
  },
  run: async ({ examRepo, workRepo, triagedLabel }) => {
    const id = await createProbation({
      examRepo,
      workRepo: workRepo ?? null,
      triagedLabel,
    });
    return { id, urlPath: probationPath(id) };
  },
});
