import type { TrustLevel } from "./model";

/**
 * Whether a call must clear the framework's approval gate before it runs.
 *
 * On Ask, always. On Observe, only a person may act, and the action refuses
 * agents outright with a clear reason. The exception is plain HTTP: the "this is
 * the app's UI" label is a header anyone can send, so the action cannot trust it.
 * The framework reports such a call here as `http`, and only its approval gate
 * checks the UI's signed capability. A proven UI request never reaches this.
 */
export function requiresApproval(
  level: TrustLevel,
  caller: string | undefined,
): boolean {
  return level === "ask" || (level === "observe" && caller === "http");
}
