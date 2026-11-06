import { defineAction } from "@agent-native/core/action";
import { z } from "zod";

import { listProbations } from "../server/services/probations.js";
import { probationSummarySchema } from "../shared/contracts.js";

export default defineAction({
  description: "List the probations the current user can see, newest first.",
  mcpTool: true,
  schema: z.object({}),
  outputSchema: z.array(probationSummarySchema),
  http: { method: "GET" },
  run: () => listProbations(),
});
