import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import {
  loadReadableProbation,
  policyOf,
} from "../server/services/probations.js";
import { loadTrustCells } from "../server/services/trust-map.js";
import { probationIdSchema, simulationSchema } from "../shared/contracts.js";
import { trustPolicySchema } from "../shared/trust/policy.js";
import { simulatePolicy } from "../shared/trust/simulate.js";

export default defineAction({
  description:
    "Replay graded history under a candidate trust policy, per 100 issues: solved alone, wrong alone, asked and watched. Changes nothing.",
  schema: z.object({
    probationId: probationIdSchema,
    policy: trustPolicySchema.describe(
      "Candidate policy. Read the current one with get-probation and change only the bars in question.",
    ),
  }),
  outputSchema: simulationSchema,
  readOnly: true,
  run: async ({ probationId, policy }) => {
    const probation = await loadReadableProbation(probationId);
    const cells = await loadTrustCells(probation.id, policyOf(probation));
    return simulatePolicy(cells, policy);
  },
});
