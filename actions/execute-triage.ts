import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { withGitHubErrors } from "../server/github/action-errors.js";
import { gitHubWriter } from "../server/github/credentials.js";
import {
  loadProbation,
  loadReadableProbation,
} from "../server/services/probations.js";
import { executeTriage, loadProposedWork } from "../server/services/work.js";
import { probationIdSchema, workItemSchema } from "../shared/contracts.js";

export default defineAction({
  description:
    "Carry out a recorded proposal on GitHub, subject to the trust map: Solo runs, Ask waits for a person to approve this exact call, Observe is refused for agents.",
  schema: z.object({
    probationId: probationIdSchema,
    workItemId: z.string().min(1).max(64),
  }),
  outputSchema: z.object({ item: workItemSchema }),
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
  },
  /**
   * The same gate holds for the in-app agent, MCP, A2A, HTTP and the CLI, because
   * they all dispatch this one action. A throw here fails closed.
   */
  needsApproval: async ({ probationId, workItemId }) => {
    const probation = await loadReadableProbation(probationId);
    const { level } = await loadProposedWork(probation.id, workItemId);
    return level === "ask";
  },
  run: async ({ probationId, workItemId }, ctx) => {
    const probation = await loadProbation(probationId, "editor");
    const work = await loadProposedWork(probation.id, workItemId);
    const isPerson = ctx?.caller === "frontend";
    if (work.level === "observe" && !isPerson) {
      fail(
        "This cell is on Observe, so the proposal stays a suggestion until a person acts on it or the agent earns more.",
        { errorCode: "observe_only", statusCode: 403 },
      );
    }
    const actor = !isPerson && work.level === "solo" ? "agent" : "human";
    return withGitHubErrors(async () => ({
      item: await executeTriage(probation, await gitHubWriter(), work, actor),
    }));
  },
});
