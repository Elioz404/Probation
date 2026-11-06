import type { Disposition } from "../../shared/trust/model.js";

const API_ORIGIN = "https://api.github.com";
const API_VERSION = "2022-11-28";
const MAX_PER_PAGE = 100;

export type GitHubFailure =
  | "not_found"
  | "rate_limited"
  | "unauthorized"
  | "forbidden"
  | "invalid"
  | "unavailable";

/** Carries a classification, never a response body or a credential. */
export class GitHubError extends Error {
  constructor(
    readonly failure: GitHubFailure,
    readonly status: number,
  ) {
    super(`GitHub request failed: ${failure} (${status})`);
    this.name = "GitHubError";
  }
}

export interface GitHubIssue {
  number: number;
  url: string;
  title: string;
  body: string;
  authorAssociation: string;
  authorIsBot: boolean;
  labels: string[];
}

export interface ClosedIssueSample {
  /** Closed issues with this outcome on GitHub, not just those returned. */
  total: number;
  issues: GitHubIssue[];
}

/** GitHub issue search qualifier for each maintainer outcome. */
const OUTCOME_QUALIFIER: Readonly<Record<Disposition, string>> = {
  accept: "reason:completed",
  "close-duplicate": "reason:duplicate",
  "close-not-planned": 'reason:"not planned"',
};

/** `state_reason` value GitHub expects when closing with each outcome. */
const CLOSE_REASON = {
  "close-duplicate": "duplicate",
  "close-not-planned": "not_planned",
} as const;

export type ClosingDisposition = keyof typeof CLOSE_REASON;

interface RawIssue {
  number: number;
  html_url: string;
  title: string;
  body: string | null;
  author_association: string;
  user: { type: string } | null;
  labels: Array<string | { name?: string }>;
  pull_request?: unknown;
}

function failureFor(response: Response): GitHubFailure {
  switch (response.status) {
    case 401:
      return "unauthorized";
    case 403:
    case 429:
      return response.headers.get("x-ratelimit-remaining") === "0" ||
        response.headers.has("retry-after") ||
        response.status === 429
        ? "rate_limited"
        : "forbidden";
    case 404:
      return "not_found";
    case 410:
    case 422:
      return "invalid";
    default:
      return "unavailable";
  }
}

function toIssue(raw: RawIssue): GitHubIssue {
  return {
    number: raw.number,
    url: raw.html_url,
    title: raw.title,
    body: raw.body ?? "",
    authorAssociation: raw.author_association,
    authorIsBot: raw.user?.type === "Bot",
    labels: raw.labels.flatMap((label) => {
      const name = typeof label === "string" ? label : label.name;
      return name ? [name] : [];
    }),
  };
}

export interface GitHubClientOptions {
  token?: string | null;
  fetch?: typeof globalThis.fetch;
}

/**
 * Talks only to the fixed GitHub API origin. Repository references reach it
 * already validated by `repoRefSchema`, so no caller controls the host.
 */
export class GitHubClient {
  private readonly token: string | null;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor({ token = null, fetch: fetchImpl }: GitHubClientOptions = {}) {
    this.token = token;
    this.fetchImpl = fetchImpl ?? globalThis.fetch;
  }

  async sampleClosedIssues(
    repo: string,
    outcome: Disposition,
    limit: number,
  ): Promise<ClosedIssueSample> {
    const query = `repo:${repo} is:issue is:closed ${OUTCOME_QUALIFIER[outcome]}`;
    const params = new URLSearchParams({
      q: query,
      sort: "created",
      order: "desc",
      per_page: String(Math.min(limit, MAX_PER_PAGE)),
    });
    const result = await this.request<{
      total_count: number;
      items: RawIssue[];
    }>(`/search/issues?${params}`);
    return { total: result.total_count, issues: result.items.map(toIssue) };
  }

  async listOpenIssues(repo: string, limit: number): Promise<GitHubIssue[]> {
    const params = new URLSearchParams({
      state: "open",
      sort: "created",
      direction: "desc",
      per_page: String(Math.min(limit, MAX_PER_PAGE)),
    });
    const items = await this.request<RawIssue[]>(
      `/repos/${repo}/issues?${params}`,
    );
    return items.filter((item) => !item.pull_request).map(toIssue);
  }

  async listLabels(repo: string): Promise<string[]> {
    const labels = await this.request<Array<{ name: string }>>(
      `/repos/${repo}/labels?per_page=${MAX_PER_PAGE}`,
    );
    return labels.map((label) => label.name);
  }

  async closeIssue(
    repo: string,
    issueNumber: number,
    disposition: ClosingDisposition,
  ): Promise<void> {
    await this.request(`/repos/${repo}/issues/${issueNumber}`, {
      method: "PATCH",
      body: { state: "closed", state_reason: CLOSE_REASON[disposition] },
    });
  }

  async reopenIssue(repo: string, issueNumber: number): Promise<void> {
    await this.request(`/repos/${repo}/issues/${issueNumber}`, {
      method: "PATCH",
      body: { state: "open" },
    });
  }

  async addLabels(
    repo: string,
    issueNumber: number,
    labels: readonly string[],
  ): Promise<void> {
    if (labels.length === 0) return;
    await this.request(`/repos/${repo}/issues/${issueNumber}/labels`, {
      method: "POST",
      body: { labels },
    });
  }

  private async request<T>(
    path: string,
    { method = "GET", body }: { method?: string; body?: unknown } = {},
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${API_ORIGIN}${path}`, {
        method,
        redirect: "error",
        headers: {
          accept: "application/vnd.github+json",
          "x-github-api-version": API_VERSION,
          "user-agent": "probation-app",
          ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    } catch {
      throw new GitHubError("unavailable", 0);
    }
    if (!response.ok)
      throw new GitHubError(failureFor(response), response.status);
    return (await response.json()) as T;
  }
}
