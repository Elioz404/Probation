import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { updatePolicy } from "../server/services/probations.js";
import { probationIdSchema } from "../shared/contracts.js";
import { trustPolicySchema } from "../shared/trust/policy.js";

export default defineAction({
  description:
    "Change the bars a cell must clear to earn a level. Only a person can do this: an agent must not move its own goalposts.",
  uiOnly: true,
  schema: z.object({
    probationId: probationIdSchema,
    policy: trustPolicySchema,
  }),
  outputSchema: z.object({ probationId: z.string() }),
  run: async ({ probationId, policy }) => {
    await updatePolicy(probationId, policy);
    return { probationId };
  },
});
