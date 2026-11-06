import { simulatePolicy } from "../../shared/trust/simulate.js";
import { policyOf, type ProbationRow } from "./probations.js";
import { listPromotions } from "./promotions.js";
import { loadTrustCells } from "./trust-map.js";

/** Everything the trust map screen and the agent need in one read. */
export async function getTrustOverview(probation: ProbationRow) {
  const policy = policyOf(probation);
  const [cells, promotions] = await Promise.all([
    loadTrustCells(probation.id, policy),
    listPromotions(probation.id),
  ]);
  return { cells, promotions, simulation: simulatePolicy(cells, policy) };
}
