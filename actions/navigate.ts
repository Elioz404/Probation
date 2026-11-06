import { defineAction } from "@agent-native/core/action";
import { writeAppStateForCurrentTab } from "@agent-native/core/application-state";
import { z } from "zod";

import { PROBATION_TABS, probationPath } from "../shared/navigation.js";

export default defineAction({
  description:
    "Open a screen for the user: a named view, a path, or a probation and tab.",
  schema: z.object({
    view: z
      .string()
      .optional()
      .describe('View name, such as "home" or "chat".'),
    path: z.string().optional().describe("URL path to open."),
    threadId: z.string().optional().describe("Chat thread id to open."),
    probationId: z.string().optional().describe("Probation to open."),
    tab: z
      .enum(PROBATION_TABS)
      .optional()
      .describe('Probation tab: "map", "work" or "record".'),
  }),
  outputSchema: z.object({ message: z.string() }),
  http: false,
  run: async ({ view, path, threadId, probationId, tab }) => {
    const destination = probationId ? probationPath(probationId, tab) : path;
    if (!view && !destination) {
      throw new Error("Provide view, path or probationId.");
    }
    await writeAppStateForCurrentTab("navigate", {
      ...(view ? { view } : {}),
      ...(destination ? { path: destination } : {}),
      ...(threadId ? { threadId } : {}),
      _writeId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });
    return { message: `Navigating to ${view ?? destination}` };
  },
});
