import { z } from "zod";

const REPO_REF = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const GITHUB_URL_PREFIX = /^(?:https?:\/\/)?(?:www\.)?github\.com\//i;

/** Accepts `owner/name` or a github.com URL and returns canonical `owner/name`. */
export function normalizeRepoRef(input: string): string | null {
  const candidate = input
    .trim()
    .replace(GITHUB_URL_PREFIX, "")
    .replace(/\.git$/i, "")
    .replace(/\/+$/, "");
  if (!REPO_REF.test(candidate) || candidate.split("/")[1]!.startsWith(".")) {
    return null;
  }
  return candidate;
}

export const repoRefSchema = z
  .string()
  .max(300)
  .transform((value, ctx) => {
    const repo = normalizeRepoRef(value);
    if (repo === null) {
      ctx.addIssue({
        code: "custom",
        message: 'Use "owner/name" or a github.com repository URL.',
      });
      return z.NEVER;
    }
    return repo;
  });
