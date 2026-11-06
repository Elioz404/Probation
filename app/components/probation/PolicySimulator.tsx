import {
  actionErrorMessage,
  useActionMutation,
} from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { TRIAGE_ACTIONS, type TriageAction } from "@shared/trust/model";
import type { TrustPolicy } from "@shared/trust/policy";
import { simulatePolicy } from "@shared/trust/simulate";
import { useMemo } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { formatPercent, useTrustLabels } from "./labels";
import type { TrustCell } from "./types";

const SEGMENTS = [
  { key: "solvedAlonePer100", className: "bg-[hsl(var(--level-solo))]" },
  { key: "wrongAlonePer100", className: "bg-destructive" },
  { key: "askedPer100", className: "bg-[hsl(var(--level-ask))]" },
  { key: "watchedPer100", className: "bg-muted-foreground/30" },
] as const;

/** Moving a Solo bar below the Ask bar drags the Ask bar with it. */
function withSoloBar(
  policy: TrustPolicy,
  action: TriageAction,
  solo: number,
): TrustPolicy {
  return {
    ...policy,
    bars: {
      ...policy.bars,
      [action]: { ask: Math.min(policy.bars[action].ask, solo), solo },
    },
  };
}

export function PolicySimulator({
  probationId,
  cells,
  saved,
  draft,
  onDraftChange,
  baseline,
}: {
  probationId: string;
  cells: readonly TrustCell[];
  saved: TrustPolicy;
  draft: TrustPolicy;
  onDraftChange: (policy: TrustPolicy) => void;
  baseline: number | null;
}) {
  const t = useT();
  const labels = useTrustLabels();
  const save = useActionMutation("update-trust-policy");
  const result = useMemo(() => simulatePolicy(cells, draft), [cells, draft]);
  const isDirty = JSON.stringify(saved) !== JSON.stringify(draft);

  return (
    <aside className="grid content-start gap-5">
      <section aria-label={t("probation.simulator.title")}>
        <h2 className="text-sm font-semibold">
          {t("probation.simulator.title")}
        </h2>
        <div
          aria-hidden
          className="mt-3 flex h-2 overflow-hidden rounded-full bg-muted"
        >
          {SEGMENTS.map(({ key, className }) => (
            <div
              key={key}
              className={`${className} transition-[width] duration-150`}
              style={{ width: `${result[key]}%` }}
            />
          ))}
        </div>
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1 text-sm">
          {SEGMENTS.map(({ key }) => (
            <div key={key} className="contents">
              <dt className="text-muted-foreground">
                {t(`probation.simulator.${key}`)}
              </dt>
              <dd className="text-right font-medium tabular-nums">
                {result.gradedCases > 0 ? result[key].toFixed(1) : "–"}
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("probation.simulator.basis", { count: result.gradedCases })}
        </p>
      </section>

      <fieldset className="grid gap-3">
        <legend className="mb-2 text-sm font-semibold">
          {t("probation.simulator.bars")}
        </legend>
        {TRIAGE_ACTIONS.map((action) => {
          const id = `solo-bar-${action}`;
          const solo = draft.bars[action].solo;
          return (
            <div key={action} className="grid gap-1">
              <label htmlFor={id} className="flex justify-between text-sm">
                <span>{labels.action(action)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatPercent(solo)}
                </span>
              </label>
              <input
                id={id}
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={solo}
                onChange={(event) =>
                  onDraftChange(
                    withSoloBar(draft, action, Number(event.target.value)),
                  )
                }
                className="w-full accent-foreground"
              />
            </div>
          );
        })}
        {isDirty ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={save.isPending}
              onClick={() =>
                save.mutate(
                  { probationId, policy: draft },
                  {
                    onError: (error) =>
                      toast.error(
                        actionErrorMessage(error) ??
                          t("probation.simulator.saveFailed"),
                      ),
                  },
                )
              }
            >
              {t("probation.simulator.save")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDraftChange(saved)}
            >
              {t("probation.simulator.reset")}
            </Button>
          </div>
        ) : null}
      </fieldset>

      {baseline !== null ? (
        <p className="border-t border-border pt-4 text-sm text-muted-foreground">
          {t("probation.simulator.baseline", {
            share: formatPercent(baseline),
          })}
        </p>
      ) : null}
    </aside>
  );
}
