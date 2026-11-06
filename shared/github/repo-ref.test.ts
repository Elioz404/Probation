import { describe, expect, it } from "vitest";

import { normalizeRepoRef } from "./repo-ref";

describe("normalizeRepoRef", () => {
  it("keeps canonical references", () => {
    expect(normalizeRepoRef("vercel/next.js")).toBe("vercel/next.js");
  });

  it("reads github.com URLs", () => {
    expect(normalizeRepoRef("https://github.com/vercel/next.js/")).toBe(
      "vercel/next.js",
    );
    expect(normalizeRepoRef("github.com/vercel/next.js.git")).toBe(
      "vercel/next.js",
    );
  });

  it.each([
    "",
    "vercel",
    "a/b/c",
    "../../etc/passwd",
    "owner/..",
    "own er/name",
    "https://evil.example/owner/name",
    "owner/name?per_page=1",
  ])("rejects %j", (input) => {
    expect(normalizeRepoRef(input)).toBeNull();
  });
});
