import { DISPOSITIONS, type CellKey, type Disposition } from "./model";
import type { TrustPolicy } from "./policy";
import { earnedLevel, type CellAggregate } from "./stats";

export interface SimulationCell extends CellKey {
  aggregate: CellAggregate;
}

/** Shares of past issues, normalized per 100 so repositories compare. */
export interface SimulationResult {
  gradedCases: number;
  solvedAlonePer100: number;
  wrongAlonePer100: number;
  askedPer100: number;
  watchedPer100: number;
}

const isDisposition = (action: string): action is Disposition =>
  (DISPOSITIONS as readonly string[]).includes(action);

/**
 * Replays graded history under a candidate policy. Runs on aggregates only, so
 * the browser can recompute on every slider tick with this exact function.
 * Labels are excluded: they accompany a disposition rather than resolve an issue.
 */
export function simulatePolicy(
  cells: readonly SimulationCell[],
  policy: TrustPolicy,
): SimulationResult {
  let total = 0;
  let cases = 0;
  let solvedAlone = 0;
  let wrongAlone = 0;
  let asked = 0;
  let watched = 0;

  for (const { action, aggregate } of cells) {
    if (!isDisposition(action)) continue;
    total += aggregate.weightedTotal;
    cases += aggregate.cases;
    const level = earnedLevel(aggregate, action, policy);
    if (level === "solo") {
      solvedAlone += aggregate.weightedCorrect;
      wrongAlone += aggregate.weightedTotal - aggregate.weightedCorrect;
    } else if (level === "ask") {
      asked += aggregate.weightedTotal;
    } else {
      watched += aggregate.weightedTotal;
    }
  }

  const per100 = (part: number) => (total > 0 ? (part / total) * 100 : 0);
  return {
    gradedCases: cases,
    solvedAlonePer100: per100(solvedAlone),
    wrongAlonePer100: per100(wrongAlone),
    askedPer100: per100(asked),
    watchedPer100: per100(watched),
  };
}

/**
 * Share of issues an agent that accepts everything would get right. High values
 * are the trap: accuracy looks great while every rejection slips through.
 */
export function acceptEverythingBaseline(
  populations: Readonly<Record<Disposition, number>>,
): number | null {
  const total = DISPOSITIONS.reduce((sum, d) => sum + populations[d], 0);
  return total > 0 ? populations.accept / total : null;
}
