import { fail } from "@agent-native/core/action";
import { registerRequiredSecret } from "@agent-native/core/secrets";
import {
  readDeployCredentialEnv,
  resolveSecretDetailed,
} from "@agent-native/core/server";

import { GitHubClient } from "./client.js";

const USER_TOKEN_KEY = "PROBATION_GITHUB_TOKEN";

/**
 * Deployment-owned token with no scopes, used only to raise the rate limit on
 * public data. It never authorizes a write or a private repository.
 */
const PUBLIC_READ_TOKEN_ENV = "GITHUB_PUBLIC_READ_TOKEN";

registerRequiredSecret({
  key: USER_TOKEN_KEY,
  label: "GitHub token",
  description:
    "Fine-grained token limited to your work repository, with Issues read and write. Lets the agent act on that repository, and gives exams on public repositories enough GitHub API reads.",
  docsUrl: "https://github.com/settings/personal-access-tokens/new",
  scope: "user",
  kind: "api-key",
  required: false,
});

async function resolveUserToken(): Promise<string | null> {
  const detail = await resolveSecretDetailed(USER_TOKEN_KEY);
  if (detail.lookupFailed) {
    fail("The credential store is unavailable. Try again shortly.", {
      errorCode: "credentials_unavailable",
      statusCode: 503,
    });
  }
  // A token that came from deployment env is not the user's to spend.
  return detail.source === "env" ? null : detail.value;
}

export async function gitHubReader(): Promise<GitHubClient> {
  const token =
    (await resolveUserToken()) ??
    readDeployCredentialEnv(PUBLIC_READ_TOKEN_ENV) ??
    null;
  return new GitHubClient({ token });
}

export async function gitHubWriter(): Promise<GitHubClient> {
  const token = await resolveUserToken();
  if (!token) {
    fail("Add a GitHub token in Settings to act on the work repository.", {
      errorCode: "github_token_required",
      statusCode: 412,
    });
  }
  return new GitHubClient({ token });
}
