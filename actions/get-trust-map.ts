import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { loadReadableProbation } from "../server/services/probations.js";
import { getTrustOverview } from "../server/services/trust-overview.js";
import { probationIdSchema, trustMapSchema } from "../shared/contracts.js";

export default defineAction({
  description:
    "Read the trust map: for each action and issue context, the level granted, the level the evidence supports and the evidence itself, plus promotion requests and a replay of history under the current policy.",
  schema: z.object({ probationId: probationIdSchema }),
  outputSchema: trustMapSchema,
  http: { method: "GET" },
  run: async ({ probationId }) =>
    getTrustOverview(await loadReadableProbation(probationId)),
});
