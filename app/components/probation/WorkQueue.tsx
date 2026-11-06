import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { DISPOSITIONS, type Disposition } from "@shared/trust/model";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useTrustLabels } from "./labels";
import type { ProbationDetail, WorkItem } from "./types";

function OverruleForm({
  probationId,
  item,
  proposed,
  onDone,
}: {
  probationId: string;
  item: WorkItem;
  proposed: Disposition;
  onDone: () => void;
}) {
  const t = useT();
  const labels = useTrustLabels();
  const overrule = useActionMutation("overrule-triage");
  const options = DISPOSITIONS.filter((option) => option !== proposed);
  const [correct, setCorrect] = useState<Disposition>(options[0]!);
  const [note, setNote] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    overrule.mutate(
      {
        probationId,
        workItemId: item.id,
        correctDisposition: correct,
        note,
      },
      {
        onSuccess: ({ newLevel }) => {
          toast.success(
            t("probation.work.demoted", { level: labels.level(newLevel) }),
          );
          onDone();
        },
        onError: (error) =>
          toast.error(actionErrorMessage(error) ?? t("probation.work.failed")),
      },
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2">
      <select
        value={correct}
        aria-label={t("probation.work.correctOutcome")}
        onChange={(event) => setCorrect(event.target.value as Disposition)}
        className="h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labels.action(option)}
          </option>
        ))}
      </select>
      <Input
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={t("probation.work.whyWrong")}
        aria-label={t("probation.work.whyWrong")}
        maxLength={500}
        required
        className="h-8 min-w-48 flex-1"
      />
      <Button
        type="submit"
        size="sm"
        variant="destructive"
        disabled={overrule.isPending || note.trim() === ""}
      >
        {t("probation.work.confirmOverrule")}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDone}>
        {t("probation.work.cancel")}
      </Button>
    </form>
  );
}

function WorkRow({
  probationId,
  item,
}: {
  probationId: string;
  item: WorkItem;
}) {
  const t = useT();
  const labels = useTrustLabels();
  const execute = useActionMutation("execute-triage");
  const [overruling, setOverruling] = useState(false);
  const proposed = item.proposedDisposition;
  const canAct = item.status === "proposed" || item.status === "executed";

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <a
          href={item.issueUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
        >
          #{item.issueNumber} {item.title}
        </a>
        <span className="text-xs text-muted-foreground">
          {labels.context(item.context)}
        </span>
        <span className="text-xs font-medium">
          {t(`probation.work.status.${item.status}`)}
        </span>
      </div>
      {proposed ? (
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {labels.action(proposed)}
            </span>
            {item.proposedLabels.length > 0
              ? ` · ${item.proposedLabels.join(", ")}`
              : ""}
            {item.proposedRationale ? ` · ${item.proposedRationale}` : ""}
          </p>
          {item.status === "proposed" && item.currentLevel ? (
            <span className="text-xs text-muted-foreground">
              {t("probation.work.autonomy", {
                level: labels.level(item.currentLevel),
              })}
            </span>
          ) : null}
          {item.status === "proposed" ? (
            <Button
              size="sm"
              disabled={execute.isPending}
              onClick={() =>
                execute.mutate(
                  { probationId, workItemId: item.id },
                  {
                    onError: (error) =>
                      toast.error(
                        actionErrorMessage(error) ?? t("probation.work.failed"),
                      ),
                  },
                )
              }
            >
              {t("probation.work.approve")}
            </Button>
          ) : null}
          {canAct && !overruling ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setOverruling(true)}
            >
              {t("probation.work.overrule")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {overruling && proposed ? (
        <OverruleForm
          probationId={probationId}
          item={item}
          proposed={proposed}
          onDone={() => setOverruling(false)}
        />
      ) : null}
      {item.overruleNote ? (
        <p className="mt-1 text-sm text-pretty text-muted-foreground">
          {t("probation.work.overruledNote", { note: item.overruleNote })}
        </p>
      ) : null}
    </li>
  );
}

export function WorkQueue({ probation }: { probation: ProbationDetail }) {
  const t = useT();
  const { id, workRepo } = probation;
  const { data: items } = useActionQuery("list-work-items", {
    probationId: id,
  });
  const sync = useActionMutation("sync-work-issues");

  if (!workRepo) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("probation.work.noRepo")}
      </p>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={sync.isPending}
          onClick={() =>
            sync.mutate(
              { probationId: id },
              {
                onError: (error) =>
                  toast.error(
                    actionErrorMessage(error) ?? t("probation.work.failed"),
                  ),
              },
            )
          }
        >
          {t("probation.work.sync")}
        </Button>
        <Button
          size="sm"
          onClick={() =>
            sendToAgentChat({
              message: "Work through the queue for this probation.",
              context: `Probation id: ${id}`,
              submit: true,
              openSidebar: true,
            })
          }
        >
          {t("probation.work.sendAgent")}
        </Button>
      </div>
      {items && items.length > 0 ? (
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {items.map((item) => (
            <WorkRow key={item.id} probationId={id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("probation.work.empty", { repo: workRepo })}
        </p>
      )}
    </section>
  );
}
