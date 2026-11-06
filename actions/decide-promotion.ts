import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { loadProbation } from "../server/services/probations.js";
import {
  declinePromotion,
  signPromotion,
} from "../server/services/promotions.js";
import { probationIdSchema } from "../shared/contracts.js";

const decisionSchema = z.enum(["sign", "decline"]);

export default defineAction({
  description:
    "Sign or decline a promotion request. Only a person can do this: an agent never promotes itself.",
  uiOnly: true,
  schema: z.object({
    probationId: probationIdSchema,
    requestId: z.string().min(1).max(64),
    decision: decisionSchema,
  }),
  outputSchema: z.object({ decision: decisionSchema }),
  run: async ({ probationId, requestId, decision }) => {
    const probation = await loadProbation(probationId, "editor");
    if (decision === "sign") await signPromotion(probation, requestId);
    else await declinePromotion(probation, requestId);
    return { decision };
  },
});
