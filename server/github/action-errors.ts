import { fail } from "@agent-native/core/action";

import { GitHubError, type GitHubFailure } from "./client.js";

const FAILURE_RESPONSE: Readonly<
  Record<GitHubFailure, { message: string; statusCode: number }>
> = {
  not_found: {
    message:
      "GitHub could not find that repository or issue, or the token cannot see it.",
    statusCode: 404,
  },
  rate_limited: {
    message: "GitHub's rate limit was reached. Try again in a minute.",
    statusCode: 429,
  },
  unauthorized: {
    message: "GitHub rejected the token. Update it in Settings.",
    statusCode: 412,
  },
  forbidden: {
    message: "The GitHub token does not have permission for this.",
    statusCode: 403,
  },
  invalid: {
    message: "GitHub rejected this request for that repository.",
    statusCode: 422,
  },
  unavailable: {
    message: "GitHub is unavailable right now. Try again shortly.",
    statusCode: 503,
  },
};

/** Turns adapter failures into caller-readable action errors. */
export async function withGitHubErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof GitHubError) {
      fail(FAILURE_RESPONSE[error.failure].message, {
        errorCode: `github_${error.failure}`,
        statusCode: FAILURE_RESPONSE[error.failure].statusCode,
      });
    }
    throw error;
  }
}
