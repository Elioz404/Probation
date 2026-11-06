import { describe, expect, it } from "vitest";

import { gradesOfCase } from "./trust-map.js";

const graded = {
  context: "regular-thin",
  weight: 2,
  answerDisposition: "accept",
  dispositionCorrect: true,
  labelsCorrect: null,
};

describe("gradesOfCase", () => {
  it("ignores unanswered cases", () => {
    expect(
      gradesOfCase({
        ...graded,
        answerDisposition: null,
        dispositionCorrect: null,
      }),
    ).toEqual([]);
  });

  it("charges the answer to the cell of what the agent proposed", () => {
    expect(gradesOfCase(graded)).toEqual([
      { action: "accept", context: "regular-thin", correct: true, weight: 2 },
    ]);
  });

  it("adds a separate grade when labels were graded", () => {
    const grades = gradesOfCase({ ...graded, labelsCorrect: false });
    expect(grades[1]).toEqual({
      action: "apply-labels",
      context: "regular-thin",
      correct: false,
      weight: 2,
    });
  });
});
