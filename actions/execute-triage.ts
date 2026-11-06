import { defineAction, fail } from "@agent-native/core/action";
import { z } from "zod";

import { withGitHubErrors } from "../server/github/action-errors.js";
import { gitHubWriter } from "../server/github/credentials.js";
import {
  loadProbation,
  loadReadableProbation,
} from "../server/services/probations.js";
import { executeTriage, loadProposedWork } from "../server/services/work.js";
import {
  probationIdSchema,
  workItemSchema,
  workItemIdSchema,
} from "../shared/contracts.js";
import { requiresApproval } from "../shared/trust/gate.js";

export default defineAction({
  description:
    "Carry out a recorded proposal on GitHub, subject to the trust map: Solo runs, Ask waits for a person to approve this exact call, Observe is refused for agents.",
  mcpTool: true,
  schema: z.object({
    probationId: probationIdSchema,
    workItemId: workItemIdSchema,
  }),
  outputSchema: z.object({ item: workItemSchema }),
  mcpAnnotations: {
    readOnlyHint: false,
    destructiveHint: true,
    openWorldHint: true,
  },
  /**
   * Every surface dispatches this one action, so they all meet this gate.
   * A throw here fails closed.
   */
  needsApproval: async ({ probationId, workItemId }, ctx) => {
    const probation = await loadReadableProbation(probationId);
    const { level } = await loadProposedWork(probation.id, workItemId);
    return requiresApproval(level, ctx?.caller);
  },
  run: async ({ probationId, workItemId }, ctx) => {
    const probation = await loadProbation(probationId, "editor");
    const work = await loadProposedWork(probation.id, workItemId);
    const isPerson = ctx?.caller === "frontend";
    if (work.level === "observe" && !isPerson) {
      fail(
        `The ${work.weakestCell.action} cell for ${work.weakestCell.context} is on Observe, and a proposal is limited by the lowest cell it touches. It stays a suggestion until a person acts on it or the agent earns more.`,
        {
          errorCode: "observe_only",
          statusCode: 403,
          details: { blockingCell: work.weakestCell },
        },
      );
    }
    const actor = !isPerson && work.level === "solo" ? "agent" : "human";
    return withGitHubErrors(async () => ({
      item: await executeTriage(probation, await gitHubWriter(), work, actor),
    }));
  },
});
