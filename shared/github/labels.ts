export interface LabelMatch {
  /** Proposed labels in the repository's own spelling. */
  known: string[];
  unknown: string[];
}

/**
 * Checks labels against a repository's catalog, ignoring case. GitHub creates any
 * label it does not recognize, so an unchecked typo would change the repository.
 */
export function matchLabels(
  proposed: readonly string[],
  catalog: readonly string[],
): LabelMatch {
  const canonical = new Map(
    catalog.map((label) => [label.trim().toLowerCase(), label]),
  );
  const known: string[] = [];
  const unknown: string[] = [];
  for (const label of proposed) {
    const match = canonical.get(label.trim().toLowerCase());
    if (match === undefined) unknown.push(label);
    else if (!known.includes(match)) known.push(match);
  }
  return { known, unknown };
}
