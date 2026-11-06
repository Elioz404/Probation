import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { withGitHubErrors } from "../server/github/action-errors.js";
import { gitHubWriter } from "../server/github/credentials.js";
import { loadProbation } from "../server/services/probations.js";
import { overruleTriage } from "../server/services/work.js";
import { probationIdSchema, workItemSchema } from "../shared/contracts.js";
import { dispositionSchema, trustLevelSchema } from "../shared/trust/model.js";

export default defineAction({
  description:
    "Overrule the agent on a work item. The cell drops a level at once, the case joins the exam with extra weight, and a wrongly closed issue is reopened. Only a person can do this.",
  uiOnly: true,
  schema: z.object({
    probationId: probationIdSchema,
    workItemId: z.string().min(1).max(64),
    correctDisposition: dispositionSchema,
    note: z.string().trim().min(1).max(500),
  }),
  outputSchema: z.object({ item: workItemSchema, newLevel: trustLevelSchema }),
  run: async ({ probationId, ...input }) => {
    const probation = await loadProbation(probationId, "editor");
    return withGitHubErrors(() =>
      overruleTriage(probation, gitHubWriter, input),
    );
  },
});
