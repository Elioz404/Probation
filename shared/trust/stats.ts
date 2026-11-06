import {
  allCellKeys,
  cellKeyOf,
  type CellKey,
  type TrustLevel,
  type TriageAction,
} from "./model";
import type { TrustPolicy } from "./policy";

/**
 * Sufficient statistics for one trust-map cell. Exam samples are stratified, so
 * each graded case carries a weight restoring the repository's real proportions.
 */
export interface CellAggregate {
  cases: number;
  weightedCorrect: number;
  weightedTotal: number;
  sumSquaredWeights: number;
}

export function emptyAggregate(): CellAggregate {
  return {
    cases: 0,
    weightedCorrect: 0,
    weightedTotal: 0,
    sumSquaredWeights: 0,
  };
}

export function addGrade(
  aggregate: CellAggregate,
  correct: boolean,
  weight: number,
): CellAggregate {
  return {
    cases: aggregate.cases + 1,
    weightedCorrect: aggregate.weightedCorrect + (correct ? weight : 0),
    weightedTotal: aggregate.weightedTotal + weight,
    sumSquaredWeights: aggregate.sumSquaredWeights + weight * weight,
  };
}

export function accuracyOf(aggregate: CellAggregate): number | null {
  return aggregate.weightedTotal > 0
    ? aggregate.weightedCorrect / aggregate.weightedTotal
    : null;
}

/** Kish effective sample size: uneven weights carry less evidence than n. */
export function effectiveSamples(aggregate: CellAggregate): number {
  return aggregate.sumSquaredWeights > 0
    ? aggregate.weightedTotal ** 2 / aggregate.sumSquaredWeights
    : 0;
}

/** One-sided 95% normal quantile: we only care about the pessimistic side. */
const CONFIDENCE_Z = 1.645;

/** Lower Wilson bound: accuracy we can defend given how little we have seen. */
export function wilsonLowerBound(accuracy: number, samples: number): number {
  if (samples <= 0) return 0;
  const z2 = CONFIDENCE_Z ** 2;
  const denominator = 1 + z2 / samples;
  const center = accuracy + z2 / (2 * samples);
  const margin =
    CONFIDENCE_Z *
    Math.sqrt((accuracy * (1 - accuracy) + z2 / (4 * samples)) / samples);
  return Math.max(0, (center - margin) / denominator);
}

export function defensibleAccuracy(aggregate: CellAggregate): number {
  const accuracy = accuracyOf(aggregate);
  return accuracy === null
    ? 0
    : wilsonLowerBound(accuracy, effectiveSamples(aggregate));
}

/** The highest level this evidence supports. A person still has to grant it. */
export function earnedLevel(
  aggregate: CellAggregate,
  action: TriageAction,
  policy: TrustPolicy,
): TrustLevel {
  if (effectiveSamples(aggregate) < policy.minSamples) return "observe";
  const score = defensibleAccuracy(aggregate);
  const bar = policy.bars[action];
  if (score >= bar.solo) return "solo";
  if (score >= bar.ask) return "ask";
  return "observe";
}

export interface GradedCell extends CellKey {
  correct: boolean;
  weight: number;
}

export function aggregateGrades(
  grades: readonly GradedCell[],
): Map<string, CellAggregate> {
  const aggregates = new Map(
    allCellKeys().map((key) => [cellKeyOf(key), emptyAggregate()]),
  );
  for (const grade of grades) {
    const key = cellKeyOf(grade);
    aggregates.set(
      key,
      addGrade(
        aggregates.get(key) ?? emptyAggregate(),
        grade.correct,
        grade.weight,
      ),
    );
  }
  return aggregates;
}
