import { describe, expect, it } from "vitest";

import { DEFAULT_TRUST_POLICY } from "./policy";
import {
  accuracyOf,
  addGrade,
  aggregateGrades,
  earnedLevel,
  effectiveSamples,
  emptyAggregate,
  wilsonLowerBound,
  type CellAggregate,
} from "./stats";

function aggregateOf(
  correct: number,
  wrong: number,
  weight = 1,
): CellAggregate {
  let aggregate = emptyAggregate();
  for (let i = 0; i < correct; i++)
    aggregate = addGrade(aggregate, true, weight);
  for (let i = 0; i < wrong; i++)
    aggregate = addGrade(aggregate, false, weight);
  return aggregate;
}

describe("wilsonLowerBound", () => {
  it("is zero with no evidence", () => {
    expect(wilsonLowerBound(1, 0)).toBe(0);
  });

  it("does not trust a perfect score over few samples", () => {
    expect(wilsonLowerBound(1, 3)).toBeLessThan(0.6);
    expect(wilsonLowerBound(1, 100)).toBeGreaterThan(0.95);
  });
});

describe("effectiveSamples", () => {
  it("equals n for even weights, whatever their size", () => {
    expect(effectiveSamples(aggregateOf(6, 4, 37))).toBeCloseTo(10);
  });

  it("drops when a few cases dominate the weight", () => {
    let aggregate = aggregateOf(9, 0, 1);
    aggregate = addGrade(aggregate, true, 100);
    expect(aggregate.cases).toBe(10);
    expect(effectiveSamples(aggregate)).toBeLessThan(2);
  });
});

describe("earnedLevel", () => {
  const policy = DEFAULT_TRUST_POLICY;

  it("stays at observe below the sample floor, even at 100%", () => {
    expect(earnedLevel(aggregateOf(4, 0), "accept", policy)).toBe("observe");
  });

  it("asks more of closing an issue than of accepting one", () => {
    const evidence = aggregateOf(80, 6);
    expect(earnedLevel(evidence, "accept", policy)).toBe("solo");
    expect(earnedLevel(evidence, "close-not-planned", policy)).toBe("ask");
  });

  it("does not promote a coin flip", () => {
    expect(earnedLevel(aggregateOf(20, 20), "accept", policy)).toBe("observe");
  });
});

describe("aggregateGrades", () => {
  it("creates every cell and restores weighted accuracy", () => {
    const cells = aggregateGrades([
      { action: "accept", context: "regular-thin", correct: true, weight: 3 },
      { action: "accept", context: "regular-thin", correct: false, weight: 1 },
    ]);
    expect(cells.size).toBe(16);
    expect(accuracyOf(cells.get("accept::regular-thin")!)).toBeCloseTo(0.75);
    expect(accuracyOf(cells.get("accept::newcomer-thin")!)).toBeNull();
  });
});
