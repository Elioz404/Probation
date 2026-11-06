import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { loadProbation } from "../server/services/probations.js";
import { changeLevel } from "../server/services/trust-map.js";
import { probationIdSchema } from "../shared/contracts.js";
import {
  issueContextSchema,
  triageActionSchema,
  trustLevelSchema,
} from "../shared/trust/model.js";

export default defineAction({
  description:
    "Set a trust-map cell directly, with a reason for the record. Only a person can do this; agents ask through request-promotion.",
  uiOnly: true,
  schema: z.object({
    probationId: probationIdSchema,
    action: triageActionSchema,
    context: issueContextSchema,
    level: trustLevelSchema,
    reason: z.string().trim().min(1).max(500),
  }),
  outputSchema: z.object({ level: trustLevelSchema }),
  run: async ({ probationId, action, context, level, reason }) => {
    await loadProbation(probationId, "editor");
    return {
      level: await changeLevel({
        probationId,
        key: { action, context },
        toLevel: level,
        kind: "manual",
        actor: "human",
        reason,
      }),
    };
  },
});
