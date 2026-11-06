import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { loadReadableProbation } from "../server/services/probations.js";
import { listTrustEvents } from "../server/services/trust-map.js";
import { probationIdSchema, trustEventSchema } from "../shared/contracts.js";

export default defineAction({
  description:
    "Read the record of every promotion, demotion and manual change on this probation, newest first.",
  mcpTool: true,
  schema: z.object({ probationId: probationIdSchema }),
  outputSchema: z.array(trustEventSchema),
  http: { method: "GET" },
  run: async ({ probationId }) => {
    const probation = await loadReadableProbation(probationId);
    return listTrustEvents(probation.id);
  },
});
