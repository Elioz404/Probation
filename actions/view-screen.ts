import { defineAction } from "@agent-native/core/action";
import {
  readAppState,
  readAppStateForCurrentTab,
} from "@agent-native/core/application-state";
import { z } from "zod";

import { getProbationDetail } from "../server/services/probations.js";

const navigationSchema = z
  .object({ probationId: z.string().optional() })
  .passthrough();

export default defineAction({
  description:
    "Read what the user is looking at: navigation, the open probation and the trust-map cell they selected. Use when you need more than <current-screen>.",
  schema: z.object({}),
  outputSchema: z.object({
    navigation: z.unknown().optional(),
    probation: z.unknown().optional(),
    selectedCell: z.unknown().optional(),
  }),
  http: false,
  readOnly: true,
  run: async () => {
    const navigation = navigationSchema.safeParse(
      await readAppState("navigation"),
    );
    const probationId = navigation.success
      ? navigation.data.probationId
      : undefined;
    const selectedCell = await readAppStateForCurrentTab("selection");
    return {
      ...(navigation.success ? { navigation: navigation.data } : {}),
      ...(probationId
        ? { probation: await getProbationDetail(probationId) }
        : {}),
      ...(selectedCell ? { selectedCell } : {}),
    };
  },
});
