import {
  actionErrorMessage,
  useActionMutation,
} from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { TRUST_LEVELS, type TrustLevel } from "@shared/trust/model";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { formatPercent, useTrustLabels } from "./labels";
import type { TrustCell } from "./types";

export function CellInspector({
  probationId,
  cell,
}: {
  probationId: string;
  cell: TrustCell;
}) {
  const t = useT();
  const labels = useTrustLabels();
  const setLevel = useActionMutation("set-cell-level");
  const [level, setDraftLevel] = useState<TrustLevel>(cell.granted);
  const [reason, setReason] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    setLevel.mutate(
      {
        probationId,
        action: cell.action,
        context: cell.context,
        level,
        reason,
      },
      {
        onSuccess: () => setReason(""),
        onError: (error) =>
          toast.error(actionErrorMessage(error) ?? t("probation.cell.failed")),
      },
    );
  }

  return (
    <section
      aria-label={t("probation.cell.title")}
      className="grid gap-4 border-t border-border pt-4 @2xl:grid-cols-2"
    >
      <div>
        <h2 className="text-sm font-semibold">
          {labels.action(cell.action)} · {labels.context(cell.context)}
        </h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t("probation.cell.raw")}</dt>
          <dd className="tabular-nums">{formatPercent(cell.accuracy)}</dd>
          <dt className="text-muted-foreground">
            {t("probation.cell.defensible")}
          </dt>
          <dd className="tabular-nums">
            {formatPercent(cell.defensibleAccuracy)}
          </dd>
          <dt className="text-muted-foreground">{t("probation.cell.cases")}</dt>
          <dd className="tabular-nums">
            {t("probation.cell.casesValue", {
              cases: cell.aggregate.cases,
              effective: cell.effectiveSamples.toFixed(1),
            })}
          </dd>
          <dt className="text-muted-foreground">
            {t("probation.cell.earned")}
          </dt>
          <dd>{labels.level(cell.earned)}</dd>
        </dl>
      </div>
      <form onSubmit={submit} className="grid content-start gap-2">
        <Label htmlFor="cell-level">{t("probation.cell.override")}</Label>
        <div className="flex gap-2">
          <select
            id="cell-level"
            value={level}
            onChange={(event) =>
              setDraftLevel(event.target.value as TrustLevel)
            }
            className="h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {TRUST_LEVELS.map((option) => (
              <option key={option} value={option}>
                {labels.level(option)}
              </option>
            ))}
          </select>
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("probation.cell.reason")}
            aria-label={t("probation.cell.reason")}
            maxLength={500}
            required
          />
        </div>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          className="justify-self-start"
          disabled={
            setLevel.isPending || level === cell.granted || reason.trim() === ""
          }
        >
          {t("probation.cell.apply")}
        </Button>
      </form>
    </section>
  );
}
