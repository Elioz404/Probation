import { describe, expect, it } from "vitest";

import { matchLabels } from "./labels";

describe("matchLabels", () => {
  const catalog = ["bug", "documentation", "Good First Issue"];

  it("returns the repository's own spelling", () => {
    expect(matchLabels(["BUG", "good first issue"], catalog)).toEqual({
      known: ["bug", "Good First Issue"],
      unknown: [],
    });
  });

  it("separates labels the repository does not have", () => {
    expect(matchLabels(["bug", "discussion-is-duplicate"], catalog)).toEqual({
      known: ["bug"],
      unknown: ["discussion-is-duplicate"],
    });
  });

  it("does not repeat a label", () => {
    expect(matchLabels(["bug", "Bug"], catalog).known).toEqual(["bug"]);
  });

  it("accepts an empty proposal", () => {
    expect(matchLabels([], catalog)).toEqual({ known: [], unknown: [] });
  });
});
