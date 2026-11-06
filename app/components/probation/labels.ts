import { useT } from "@agent-native/core/client/i18n";
import type {
  IssueContext,
  TriageAction,
  TrustLevel,
} from "@shared/trust/model";

/** Display names for domain values, all resolved through the locale catalog. */
export function useTrustLabels() {
  const t = useT();
  return {
    level: (level: TrustLevel) => t(`probation.level.${level}`),
    action: (action: TriageAction) => t(`probation.action.${action}`),
    context: (context: IssueContext) => t(`probation.context.${context}`),
  };
}

export function formatPercent(share: number | null): string {
  return share === null ? "–" : `${Math.round(share * 100)}%`;
}
