import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { getProbationDetail } from "../server/services/probations.js";
import {
  probationDetailSchema,
  probationIdSchema,
} from "../shared/contracts.js";

export default defineAction({
  description:
    "Read one probation: repositories, exam progress, trust policy, label catalog and the accept-everything baseline.",
  mcpTool: true,
  schema: z.object({ id: probationIdSchema }),
  outputSchema: probationDetailSchema,
  http: { method: "GET" },
  run: ({ id }) => getProbationDetail(id),
});
