import { sendToAgentChat } from "@agent-native/core/client/agent-chat";
import {
  actionErrorMessage,
  useActionMutation,
} from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import type { ProbationDetail } from "./types";

export function ExamStatus({ probation }: { probation: ProbationDetail }) {
  const t = useT();
  const importExam = useActionMutation("import-exam");
  const { id, examTotal, examAnswered } = probation;
  const remaining = examTotal - examAnswered;

  function sendAgent(message: string) {
    sendToAgentChat({
      message,
      context: `Probation id: ${id}`,
      submit: true,
      openSidebar: true,
    });
  }

  if (examTotal === 0) {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          {t("probation.exam.none")}
        </p>
        <Button
          size="sm"
          disabled={importExam.isPending}
          onClick={() =>
            importExam.mutate(
              { probationId: id },
              {
                onError: (error) =>
                  toast.error(
                    actionErrorMessage(error) ??
                      t("probation.exam.importFailed"),
                  ),
              },
            )
          }
        >
          {importExam.isPending
            ? t("probation.exam.importing")
            : t("probation.exam.import")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-4">
      <div
        role="progressbar"
        aria-label={t("probation.exam.progress")}
        aria-valuenow={examAnswered}
        aria-valuemin={0}
        aria-valuemax={examTotal}
        className="h-1.5 w-48 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full bg-foreground transition-[width] duration-300"
          style={{ width: `${(examAnswered / examTotal) * 100}%` }}
        />
      </div>
      <span className="text-sm tabular-nums text-muted-foreground">
        {t("probation.exam.answered", {
          answered: examAnswered,
          total: examTotal,
        })}
      </span>
      {remaining > 0 ? (
        <Button
          size="sm"
          onClick={() =>
            sendAgent(
              "Sit the exam for this probation until no questions remain, then file the promotion requests your evidence supports.",
            )
          }
        >
          {examAnswered === 0
            ? t("probation.exam.start")
            : t("probation.exam.resume")}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            sendAgent(
              "The exam is over. Review your results and file the promotion requests your evidence supports.",
            )
          }
        >
          {t("probation.exam.askForPromotions")}
        </Button>
      )}
    </div>
  );
}
