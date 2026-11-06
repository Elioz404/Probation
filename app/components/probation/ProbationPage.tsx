import { useActionQuery } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import {
  PROBATION_TABS,
  probationPath,
  type ProbationTab,
} from "@shared/navigation";
import { Link, useSearchParams } from "react-router";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { ExamStatus } from "./ExamStatus";
import { RecordView } from "./RecordView";
import { TrustMapView } from "./TrustMapView";
import { WorkQueue } from "./WorkQueue";

function isTab(value: string | null): value is ProbationTab {
  return (PROBATION_TABS as readonly (string | null)[]).includes(value);
}

export function ProbationPage({ id }: { id: string }) {
  const t = useT();
  const [params] = useSearchParams();
  const requested = params.get("tab");
  const tab: ProbationTab = isTab(requested) ? requested : "map";
  const { data: probation, isLoading } = useActionQuery("get-probation", {
    id,
  });

  if (!probation) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        {isLoading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <p className="text-muted-foreground">{t("probation.notFound")}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-6">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-xl font-semibold tracking-tight">
          {probation.title}
        </h1>
        {probation.workRepo ? (
          <span className="text-sm text-muted-foreground">
            {t("probation.worksOn", { repo: probation.workRepo })}
          </span>
        ) : null}
      </header>

      <ExamStatus probation={probation} />

      <nav
        aria-label={t("probation.sections")}
        className="mt-6 flex gap-5 border-b border-border text-sm"
      >
        {PROBATION_TABS.map((name) => (
          <Link
            key={name}
            to={probationPath(id, name)}
            aria-current={name === tab ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 border-transparent pb-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              name === tab && "border-foreground text-foreground",
            )}
          >
            {t(`probation.tab.${name}`)}
          </Link>
        ))}
      </nav>

      <div className="mt-6">
        {tab === "map" ? <TrustMapView probation={probation} /> : null}
        {tab === "work" ? <WorkQueue probation={probation} /> : null}
        {tab === "record" ? <RecordView probationId={id} /> : null}
      </div>
    </div>
  );
}
