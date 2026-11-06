export const PROBATION_TABS = ["map", "work", "record"] as const;
export type ProbationTab = (typeof PROBATION_TABS)[number];

export function probationPath(id: string, tab?: ProbationTab): string {
  const path = `/probations/${encodeURIComponent(id)}`;
  return tab && tab !== "map" ? `${path}?tab=${tab}` : path;
}

const PROBATION_PATH = /^\/probations\/([^/]+)\/?$/;

export function probationIdFromPath(pathname: string): string | null {
  const match = PROBATION_PATH.exec(pathname);
  return match ? decodeURIComponent(match[1]!) : null;
}
