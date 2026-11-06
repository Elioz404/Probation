import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useTrustLabels } from "./labels";
import type { ExamResult } from "./types";

function ResultRow({
  probationId,
  result,
}: {
  probationId: string;
  result: ExamResult;
}) {
  const t = useT();
  const labels = useTrustLabels();
  const contest = useActionMutation("contest-exam-case");

  return (
    <li
      className={cn(
        "grid gap-1 py-3 @md:grid-cols-[minmax(0,1fr)_auto] @md:items-start",
        result.contested && "opacity-50",
      )}
    >
      <div className="min-w-0">
        <a
          href={result.issueUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="block truncate text-sm font-medium hover:underline"
        >
          #{result.issueNumber} {result.title}
        </a>
        <p className="text-sm">
          <span
            className={
              result.dispositionCorrect
                ? "text-[hsl(var(--level-solo))]"
                : "text-destructive"
            }
          >
            {result.dispositionCorrect
              ? t("probation.record.correct")
              : t("probation.record.wrong")}
          </span>{" "}
          <span className="text-muted-foreground">
            {t("probation.record.comparison", {
              answer: labels.action(result.answerDisposition),
              truth: labels.action(result.truthDisposition),
            })}
          </span>
        </p>
        {result.answerRationale ? (
          <p className="text-sm text-pretty text-muted-foreground">
            {result.answerRationale}
          </p>
        ) : null}
      </div>
      <Button
        size="sm"
        variant="ghost"
        disabled={contest.isPending}
        onClick={() =>
          contest.mutate(
            {
              probationId,
              caseId: result.caseId,
              contested: !result.contested,
            },
            {
              onError: (error) =>
                toast.error(
                  actionErrorMessage(error) ?? t("probation.record.failed"),
                ),
            },
          )
        }
      >
        {result.contested
          ? t("probation.record.restore")
          : t("probation.record.contest")}
      </Button>
    </li>
  );
}

export function RecordView({ probationId }: { probationId: string }) {
  const t = useT();
  const labels = useTrustLabels();
  const { data: events } = useActionQuery("list-trust-events", { probationId });
  const { data: results } = useActionQuery("get-exam-results", { probationId });

  return (
    <div className="@container">
      <div className="grid gap-10 @3xl:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold">
            {t("probation.record.events")}
          </h2>
          {events && events.length > 0 ? (
            <ol className="mt-2 divide-y divide-border border-y border-border">
              {events.map((event) => (
                <li key={event.id} className="py-3">
                  <p className="text-sm font-medium">
                    {labels.action(event.action)} ·{" "}
                    {labels.context(event.context)}:{" "}
                    {labels.level(event.fromLevel)} →{" "}
                    {labels.level(event.toLevel)}
                  </p>
                  <p className="text-sm text-pretty text-muted-foreground">
                    {event.reason}
                  </p>
                  <time
                    dateTime={event.createdAt}
                    className="text-xs text-muted-foreground"
                  >
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("probation.record.noEvents")}
            </p>
          )}
        </section>
        <section>
          <h2 className="text-sm font-semibold">
            {t("probation.record.answers")}
          </h2>
          {results && results.length > 0 ? (
            <ul className="mt-2 divide-y divide-border border-y border-border">
              {results.map((result) => (
                <ResultRow
                  key={result.caseId}
                  probationId={probationId}
                  result={result}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("probation.record.noAnswers")}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
