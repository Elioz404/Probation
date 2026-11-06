import { describe, expect, it, vi } from "vitest";

import type { GitHubIssue, IssueClosure } from "../github/client.js";
import {
  caseWeight,
  estimatedDecisions,
  isProjectDecision,
  sampleProjectDecisions,
} from "./exam-sampling.js";

const closure = (over: Partial<IssueClosure> = {}): IssueClosure => ({
  reporter: "reporter",
  closer: "maintainer",
  closerIsBot: false,
  ...over,
});

const issue = (number: number, authorIsBot = false): GitHubIssue => ({
  number,
  url: `https://github.com/o/r/issues/${number}`,
  title: `#${number}`,
  body: "",
  authorAssociation: "NONE",
  authorIsBot,
  labels: [],
});

describe("isProjectDecision", () => {
  it("accepts a person closing someone else's issue", () => {
    expect(isProjectDecision(closure())).toBe(true);
  });

  it.each([
    ["a bot", { closer: "stale[bot]", closerIsBot: true }],
    ["the reporter", { closer: "reporter" }],
    ["nobody on record", { closer: null }],
  ])("rejects a closure by %s", (_name, over) => {
    expect(isProjectDecision(closure(over))).toBe(false);
  });
});

describe("sampleProjectDecisions", () => {
  const candidates = Array.from({ length: 20 }, (_, i) => issue(i + 1));

  it("skips automation and counts what it examined", async () => {
    const sample = await sampleProjectDecisions(
      candidates,
      2,
      async ({ number }) =>
        number <= 3 ? closure({ closerIsBot: true }) : closure(),
    );
    expect(sample.kept.map(({ number }) => number)).toEqual([4, 5]);
    expect(sample.examined).toBe(5);
  });

  it("stops looking once it has enough", async () => {
    const lookup = vi.fn(async () => closure());
    const sample = await sampleProjectDecisions(candidates, 2, lookup);
    expect(sample.kept).toHaveLength(2);
    expect(lookup.mock.calls.length).toBeLessThan(candidates.length);
  });

  it("rejects bot-filed issues even when a person closed them", async () => {
    const sample = await sampleProjectDecisions([issue(1, true)], 1, async () =>
      closure(),
    );
    expect(sample.kept).toEqual([]);
    expect(sample.examined).toBe(1);
  });

  it("returns what it found when candidates run out", async () => {
    const sample = await sampleProjectDecisions([issue(1)], 5, async () =>
      closure(),
    );
    expect(sample).toEqual({ kept: [issue(1)], examined: 1 });
  });
});

describe("weights", () => {
  it("scales the population by the share of real decisions", () => {
    // 1000 closed, 25 examined, 5 were project decisions: about 200 decisions.
    const kept = Array.from({ length: 5 }, (_, i) => issue(i));
    expect(caseWeight(1000, 25)).toBe(40);
    expect(estimatedDecisions(1000, { kept, examined: 25 })).toBe(200);
  });

  it("is zero with nothing examined", () => {
    expect(caseWeight(1000, 0)).toBe(0);
    expect(estimatedDecisions(1000, { kept: [], examined: 0 })).toBe(0);
  });
});
