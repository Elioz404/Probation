import type { IssueContext } from "./model";

/** GitHub author associations that mean the reporter knows the project. */
const REGULAR_ASSOCIATIONS: ReadonlySet<string> = new Set([
  "OWNER",
  "MEMBER",
  "COLLABORATOR",
  "CONTRIBUTOR",
]);

/** A report this long carries enough detail even with no code or link. */
const DETAILED_BODY_MIN_CHARS = 400;

const EVIDENCE_PATTERN = /```|https?:\/\/\S+/;

export interface IssueContextInput {
  authorAssociation: string;
  body: string;
}

/**
 * Buckets an issue using only what existed when it opened, so the same rule
 * applies to an exam question from years ago and to an issue opened today.
 */
export function classifyIssueContext({
  authorAssociation,
  body,
}: IssueContextInput): IssueContext {
  const reporter = REGULAR_ASSOCIATIONS.has(authorAssociation.toUpperCase())
    ? "regular"
    : "newcomer";
  const detail =
    body.length >= DETAILED_BODY_MIN_CHARS || EVIDENCE_PATTERN.test(body)
      ? "detailed"
      : "thin";
  return `${reporter}-${detail}`;
}
