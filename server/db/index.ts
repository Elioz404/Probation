import { createGetDb } from "@agent-native/core/db";
import { registerShareableResource } from "@agent-native/core/sharing";

import * as schema from "./schema.js";

export const getDb = createGetDb(schema);
export { schema };

export const PROBATION_RESOURCE = "probation";

registerShareableResource({
  type: PROBATION_RESOURCE,
  resourceTable: schema.probations,
  sharesTable: schema.probationShares,
  displayName: "Probation",
  titleColumn: "title",
  getResourcePath: (probation: { id: string }) => `/probations/${probation.id}`,
  agentRead: { actions: ["get-probation"] },
  getDb,
});
