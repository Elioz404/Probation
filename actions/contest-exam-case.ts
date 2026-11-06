import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { setCaseContested } from "../server/services/exam.js";
import { loadProbation } from "../server/services/probations.js";
import { probationIdSchema } from "../shared/contracts.js";

export default defineAction({
  description:
    "Strike an exam case from the evidence, or restore it, when the maintainers' historical decision was itself wrong. Only a person can do this.",
  uiOnly: true,
  schema: z.object({
    probationId: probationIdSchema,
    caseId: z.string().min(1).max(64),
    contested: z.boolean(),
  }),
  outputSchema: z.object({ caseId: z.string(), contested: z.boolean() }),
  run: async ({ probationId, caseId, contested }) => {
    await setCaseContested(
      await loadProbation(probationId, "editor"),
      caseId,
      contested,
    );
    return { caseId, contested };
  },
});
