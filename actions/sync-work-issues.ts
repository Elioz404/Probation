import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { withGitHubErrors } from "../server/github/action-errors.js";
import { gitHubReader } from "../server/github/credentials.js";
import { loadProbation } from "../server/services/probations.js";
import { syncWorkIssues } from "../server/services/work.js";
import { probationIdSchema } from "../shared/contracts.js";

export default defineAction({
  description:
    "Pull open issues from the work repository into the work queue. Known issues are skipped.",
  mcpTool: true,
  schema: z.object({ probationId: probationIdSchema }),
  outputSchema: z.object({ added: z.number() }),
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  run: async ({ probationId }) => {
    const probation = await loadProbation(probationId, "editor");
    return withGitHubErrors(async () =>
      syncWorkIssues(probation, await gitHubReader()),
    );
  },
});
