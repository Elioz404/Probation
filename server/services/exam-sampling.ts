import type { GitHubIssue, IssueClosure } from "../github/client.js";

/**
 * Closing someone else's issue takes triage rights, so a human closer who is not
 * the reporter is a real decision by the project. Bots and reporters closing
 * their own issues say nothing about how the project triages.
 */
export function isProjectDecision(closure: IssueClosure): boolean {
  return (
    closure.closer !== null &&
    !closure.closerIsBot &&
    closure.closer !== closure.reporter
  );
}

export interface OutcomeSample {
  kept: GitHubIssue[];
  /** Candidates checked to find `kept`. */
  examined: number;
}

const CLOSURE_LOOKUPS_AT_ONCE = 8;

/**
 * Walks candidates newest first and keeps project decisions until it has enough.
 * Lookups run in small batches, so it stops soon after reaching the target.
 */
export async function sampleProjectDecisions(
  candidates: readonly GitHubIssue[],
  target: number,
  closureOf: (issue: GitHubIssue) => Promise<IssueClosure>,
): Promise<OutcomeSample> {
  const kept: GitHubIssue[] = [];
  let examined = 0;
  while (examined < candidates.length && kept.length < target) {
    const batch = candidates.slice(
      examined,
      examined + CLOSURE_LOOKUPS_AT_ONCE,
    );
    const closures = await Promise.all(batch.map(closureOf));
    for (const [i, issue] of batch.entries()) {
      if (kept.length === target) break;
      examined += 1;
      if (!issue.authorIsBot && isProjectDecision(closures[i]!)) {
        kept.push(issue);
      }
    }
  }
  return { kept, examined };
}

/**
 * Each examined candidate stands for `total / examined` issues. Keeping that
 * weight on the survivors restores the outcome's share of project decisions.
 */
export function caseWeight(total: number, examined: number): number {
  return examined > 0 ? total / examined : 0;
}

export function estimatedDecisions(
  total: number,
  { kept, examined }: OutcomeSample,
): number {
  return Math.round(caseWeight(total, examined) * kept.length);
}
