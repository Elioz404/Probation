import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { loadReadableProbation } from "../server/services/probations.js";
import { listWorkItems } from "../server/services/work.js";
import { probationIdSchema, workItemSchema } from "../shared/contracts.js";

export default defineAction({
  description:
    "List the work queue with each proposal and the autonomy the current map gives it.",
  schema: z.object({ probationId: probationIdSchema }),
  outputSchema: z.array(workItemSchema),
  http: { method: "GET" },
  run: async ({ probationId }) => {
    const probation = await loadReadableProbation(probationId);
    return listWorkItems(probation.id);
  },
});
