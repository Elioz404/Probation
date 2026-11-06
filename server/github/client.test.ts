import { describe, expect, it, vi } from "vitest";

import { GitHubClient, GitHubError } from "./client.js";

function respondWith(body: unknown, init: ResponseInit = {}) {
  return vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(JSON.stringify(body), { status: 200, ...init }),
  );
}

const rawIssue = {
  number: 7,
  html_url: "https://github.com/o/r/issues/7",
  title: "Crash",
  body: null,
  author_association: "NONE",
  user: { type: "User" },
  labels: [{ name: "bug" }, "runtime", {}],
};

describe("GitHubClient", () => {
  it("searches the qualifier of the requested outcome", async () => {
    const fetch = respondWith({ total_count: 120, items: [rawIssue] });
    const client = new GitHubClient({ fetch });
    const sample = await client.sampleClosedIssues(
      "o/r",
      "close-not-planned",
      500,
    );

    const url = new URL(String(fetch.mock.calls[0]![0]));
    expect(url.origin).toBe("https://api.github.com");
    expect(url.searchParams.get("q")).toBe(
      'repo:o/r is:issue is:closed reason:"not planned"',
    );
    expect(url.searchParams.get("per_page")).toBe("100");
    expect(sample.total).toBe(120);
    expect(sample.issues[0]).toEqual({
      number: 7,
      url: "https://github.com/o/r/issues/7",
      title: "Crash",
      body: "",
      authorAssociation: "NONE",
      authorIsBot: false,
      labels: ["bug", "runtime"],
    });
  });

  it.each([
    [{ login: "github-actions[bot]", type: "Bot" }, true],
    [{ login: "nextjs-bot", type: "User" }, true],
    [{ login: "abbot", type: "User" }, false],
    [{ login: "robotics-fan", type: "User" }, false],
  ])("detects automation in closer %j", async (closedBy, closerIsBot) => {
    const fetch = respondWith({ user: { login: "r" }, closed_by: closedBy });
    const closure = await new GitHubClient({ fetch }).getIssueClosure("o/r", 7);
    expect(closure).toEqual({
      reporter: "r",
      closer: closedBy.login,
      closerIsBot,
    });
  });

  it("excludes pull requests from open issues", async () => {
    const fetch = respondWith([
      rawIssue,
      { ...rawIssue, number: 8, pull_request: {} },
    ]);
    const issues = await new GitHubClient({ fetch }).listOpenIssues("o/r", 10);
    expect(issues.map((issue) => issue.number)).toEqual([7]);
  });

  it("sends the token only as a bearer header", async () => {
    const fetch = respondWith({});
    await new GitHubClient({ token: "t0ken", fetch }).closeIssue(
      "o/r",
      7,
      "close-duplicate",
    );
    const init = fetch.mock.calls[0]![1]!;
    expect(String(fetch.mock.calls[0]![0])).not.toContain("t0ken");
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer t0ken",
    );
    expect(JSON.parse(String(init.body))).toEqual({
      state: "closed",
      state_reason: "duplicate",
    });
  });

  it("does not call GitHub when there are no labels to add", async () => {
    const fetch = respondWith({});
    await new GitHubClient({ fetch }).addLabels("o/r", 7, []);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [404, {}, "not_found"],
    [401, {}, "unauthorized"],
    [403, {}, "forbidden"],
    [403, { "x-ratelimit-remaining": "0" }, "rate_limited"],
    [429, {}, "rate_limited"],
    [422, {}, "invalid"],
    [500, {}, "unavailable"],
  ] as const)("classifies %i %j as %s", async (status, headers, failure) => {
    const fetch = respondWith(
      { message: "secret detail" },
      { status, headers },
    );
    const error = await new GitHubClient({ fetch })
      .listLabels("o/r")
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GitHubError);
    expect((error as GitHubError).failure).toBe(failure);
    expect((error as GitHubError).message).not.toContain("secret detail");
  });

  it("treats a network failure as unavailable", async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError("connect failed");
    });
    await expect(
      new GitHubClient({ fetch }).listLabels("o/r"),
    ).rejects.toMatchObject({ failure: "unavailable" });
  });
});
