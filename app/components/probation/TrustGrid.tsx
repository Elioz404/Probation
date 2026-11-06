import { useT } from "@agent-native/core/client/i18n";
import {
  cellKeyOf,
  isHigherLevel,
  ISSUE_CONTEXTS,
  TRIAGE_ACTIONS,
  type CellKey,
} from "@shared/trust/model";

import { cn } from "@/lib/utils";

import { formatPercent, useTrustLabels } from "./labels";
import type { TrustCell } from "./types";

const LEVEL_CLASS = {
  observe: "trust-cell--observe",
  ask: "trust-cell--ask",
  solo: "trust-cell--solo",
} as const;

function Cell({
  cell,
  selected,
  onSelect,
}: {
  cell: TrustCell;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useT();
  const labels = useTrustLabels();
  const canAskForMore = isHigherLevel(cell.earned, cell.granted);
  return (
    <td className="p-0.5">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={t("probation.grid.cellLabel", {
          action: labels.action(cell.action),
          context: labels.context(cell.context),
          level: labels.level(cell.granted),
        })}
        className={cn(
          "trust-cell",
          LEVEL_CLASS[cell.granted],
          selected && "trust-cell--selected",
          canAskForMore && "trust-cell--earned",
        )}
      >
        <span className="text-[11px] font-medium uppercase tracking-wide">
          {labels.level(cell.granted)}
        </span>
        <span className="text-lg font-semibold leading-none tabular-nums">
          {formatPercent(cell.accuracy)}
        </span>
        <span className="text-[11px] tabular-nums opacity-70">
          {cell.aggregate.cases > 0
            ? t("probation.grid.cases", { count: cell.aggregate.cases })
            : t("probation.grid.noCases")}
        </span>
      </button>
    </td>
  );
}

export function TrustGrid({
  cells,
  selected,
  onSelect,
  hasEvidence,
}: {
  cells: readonly TrustCell[];
  selected: CellKey | null;
  onSelect: (key: CellKey) => void;
  hasEvidence: boolean;
}) {
  const t = useT();
  const labels = useTrustLabels();
  const byKey = new Map(cells.map((cell) => [cellKeyOf(cell), cell]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] table-fixed border-separate border-spacing-0">
        <caption className="sr-only">{t("probation.grid.caption")}</caption>
        <thead>
          <tr>
            <td className="w-36" />
            {ISSUE_CONTEXTS.map((context) => (
              <th
                key={context}
                scope="col"
                className="px-1 pb-2 text-left align-bottom text-xs font-medium text-muted-foreground"
              >
                {labels.context(context)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TRIAGE_ACTIONS.map((action) => (
            <tr key={action}>
              <th scope="row" className="pe-3 text-left text-sm font-medium">
                {labels.action(action)}
              </th>
              {ISSUE_CONTEXTS.map((context) => {
                const key = { action, context };
                const cell = byKey.get(cellKeyOf(key));
                return cell ? (
                  <Cell
                    key={context}
                    cell={cell}
                    selected={
                      selected !== null &&
                      cellKeyOf(selected) === cellKeyOf(key)
                    }
                    onSelect={() => onSelect(key)}
                  />
                ) : null;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted-foreground">
        {hasEvidence ? t("probation.grid.legend") : t("probation.grid.empty")}
      </p>
    </div>
  );
}
