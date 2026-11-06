import { describe, expect, it } from "vitest";

import { classifyIssueContext } from "./context";
import { gradeAnswer } from "./grading";
import { demotedLevel } from "./model";
import { DEFAULT_TRUST_POLICY, trustPolicySchema } from "./policy";
import { acceptEverythingBaseline, simulatePolicy } from "./simulate";
import { addGrade, emptyAggregate, type CellAggregate } from "./stats";

function evidence(correct: number, wrong: number): CellAggregate {
  let aggregate = emptyAggregate();
  for (let i = 0; i < correct; i++) aggregate = addGrade(aggregate, true, 1);
  for (let i = 0; i < wrong; i++) aggregate = addGrade(aggregate, false, 1);
  return aggregate;
}

describe("classifyIssueContext", () => {
  it("separates reporters by their association with the project", () => {
    expect(
      classifyIssueContext({ authorAssociation: "MEMBER", body: "broken" }),
    ).toBe("regular-thin");
    expect(
      classifyIssueContext({ authorAssociation: "NONE", body: "broken" }),
    ).toBe("newcomer-thin");
  });

  it("treats code, links and long reports as detailed", () => {
    for (const body of [
      "```ts\nboom()\n```",
      "see https://example.com/repro",
      "x".repeat(400),
    ]) {
      expect(classifyIssueContext({ authorAssociation: "NONE", body })).toBe(
        "newcomer-detailed",
      );
    }
  });
});

describe("gradeAnswer", () => {
  const truth = { disposition: "accept", labels: ["Bug", "Runtime"] } as const;

  it("grades the disposition by exact match", () => {
    expect(
      gradeAnswer({ disposition: "accept", labels: [] }, truth)
        .dispositionCorrect,
    ).toBe(true);
    expect(
      gradeAnswer({ disposition: "close-duplicate", labels: [] }, truth)
        .dispositionCorrect,
    ).toBe(false);
  });

  it("does not grade labels when there is nothing to compare", () => {
    expect(
      gradeAnswer({ disposition: "accept", labels: [] }, truth).labelsCorrect,
    ).toBeNull();
    expect(
      gradeAnswer(
        { disposition: "accept", labels: ["bug"] },
        { disposition: "accept", labels: [] },
      ).labelsCorrect,
    ).toBeNull();
  });

  it("compares labels by precision, ignoring case", () => {
    const labelsCorrect = (labels: string[]) =>
      gradeAnswer({ disposition: "accept", labels }, truth).labelsCorrect;
    expect(labelsCorrect(["bug"])).toBe(true);
    expect(labelsCorrect(["bug", "docs"])).toBe(true);
    expect(labelsCorrect(["bug", "docs", "ui"])).toBe(false);
  });
});

describe("demotedLevel", () => {
  it("goes down one step and stops at observe", () => {
    expect(demotedLevel("solo")).toBe("ask");
    expect(demotedLevel("ask")).toBe("observe");
    expect(demotedLevel("observe")).toBe("observe");
  });
});

describe("trustPolicySchema", () => {
  it("accepts the defaults", () => {
    expect(trustPolicySchema.parse(DEFAULT_TRUST_POLICY)).toEqual(
      DEFAULT_TRUST_POLICY,
    );
  });

  it("rejects an Ask bar above the Solo bar", () => {
    const inverted = structuredClone(DEFAULT_TRUST_POLICY);
    inverted.bars.accept = { ask: 0.9, solo: 0.5 };
    expect(trustPolicySchema.safeParse(inverted).success).toBe(false);
  });
});

describe("simulatePolicy", () => {
  const cells = [
    {
      action: "accept",
      context: "regular-detailed",
      aggregate: evidence(90, 2),
    },
    {
      action: "close-duplicate",
      context: "newcomer-thin",
      aggregate: evidence(5, 3),
    },
  ] as const;

  it("splits history into solved, wrong, asked and watched", () => {
    const result = simulatePolicy(cells, DEFAULT_TRUST_POLICY);
    expect(result.gradedCases).toBe(100);
    expect(result.solvedAlonePer100).toBeCloseTo(90);
    expect(result.wrongAlonePer100).toBeCloseTo(2);
    expect(result.watchedPer100).toBeCloseTo(8);
  });

  it("gives away nothing when the bars are out of reach", () => {
    const strict = structuredClone(DEFAULT_TRUST_POLICY);
    strict.bars.accept = { ask: 1, solo: 1 };
    const result = simulatePolicy(cells, strict);
    expect(result.solvedAlonePer100).toBe(0);
    expect(result.wrongAlonePer100).toBe(0);
  });

  it("ignores label cells, which do not resolve an issue", () => {
    const result = simulatePolicy(
      [
        {
          action: "apply-labels",
          context: "regular-thin",
          aggregate: evidence(9, 1),
        },
      ],
      DEFAULT_TRUST_POLICY,
    );
    expect(result.gradedCases).toBe(0);
  });

  it("returns zeros with no graded history", () => {
    expect(simulatePolicy([], DEFAULT_TRUST_POLICY).solvedAlonePer100).toBe(0);
  });
});

describe("acceptEverythingBaseline", () => {
  it("measures how right a blind approver looks", () => {
    expect(
      acceptEverythingBaseline({
        accept: 95,
        "close-duplicate": 3,
        "close-not-planned": 2,
      }),
    ).toBeCloseTo(0.95);
  });

  it("is unknown for an empty repository", () => {
    expect(
      acceptEverythingBaseline({
        accept: 0,
        "close-duplicate": 0,
        "close-not-planned": 0,
      }),
    ).toBeNull();
  });
});
