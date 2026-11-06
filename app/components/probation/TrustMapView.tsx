import { useActionQuery } from "@agent-native/core/client/hooks";
import { writeClientAppState } from "@agent-native/core/client/hooks";
import { cellKeyOf, type CellKey } from "@shared/trust/model";
import type { TrustPolicy } from "@shared/trust/policy";
import { earnedLevel } from "@shared/trust/stats";
import { useEffect, useMemo, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { TAB_ID } from "@/lib/tab-id";

import { CellInspector } from "./CellInspector";
import { useTrustLabels } from "./labels";
import { PolicySimulator } from "./PolicySimulator";
import { PromotionDesk } from "./PromotionDesk";
import { TrustGrid } from "./TrustGrid";
import type { ProbationDetail, TrustCell } from "./types";

export function TrustMapView({ probation }: { probation: ProbationDetail }) {
  const labels = useTrustLabels();
  const { data: map } = useActionQuery("get-trust-map", {
    probationId: probation.id,
  });
  const [selected, setSelected] = useState<CellKey | null>(null);
  const [draft, setDraft] = useState<TrustPolicy>(probation.policy);

  // A saved policy from another surface replaces the local draft.
  const savedPolicy = JSON.stringify(probation.policy);
  useEffect(() => setDraft(JSON.parse(savedPolicy)), [savedPolicy]);

  // Earned levels follow the sliders, using the server's own pure function.
  const cells = useMemo<TrustCell[]>(
    () =>
      (map?.cells ?? []).map((cell) => ({
        ...cell,
        earned: earnedLevel(cell.aggregate, cell.action, draft),
      })),
    [map?.cells, draft],
  );

  function select(key: CellKey) {
    setSelected(key);
    void writeClientAppState(
      `selection:${TAB_ID}`,
      {
        kind: "trust-cell",
        probationId: probation.id,
        ...key,
        label: `${labels.action(key.action)} / ${labels.context(key.context)}`,
      },
      { requestSource: TAB_ID },
    );
  }

  if (!map) return <Skeleton className="h-96 w-full" />;

  const selectedCell = selected
    ? cells.find((cell) => cellKeyOf(cell) === cellKeyOf(selected))
    : undefined;

  return (
    <div className="@container">
      <div className="grid gap-8 @4xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid min-w-0 content-start gap-6">
          <PromotionDesk
            probationId={probation.id}
            promotions={map.promotions}
          />
          <TrustGrid
            cells={cells}
            selected={selected}
            onSelect={select}
            hasEvidence={map.simulation.gradedCases > 0}
          />
          {selectedCell ? (
            <CellInspector probationId={probation.id} cell={selectedCell} />
          ) : null}
        </div>
        <PolicySimulator
          probationId={probation.id}
          cells={cells}
          saved={probation.policy}
          draft={draft}
          onDraftChange={setDraft}
          baseline={probation.acceptEverythingBaseline}
        />
      </div>
    </div>
  );
}
