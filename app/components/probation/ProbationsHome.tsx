import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { actionErrorMessage } from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { normalizeRepoRef } from "@shared/github/repo-ref";
import { probationPath } from "@shared/navigation";
import { IconArrowRight } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { formatPercent } from "./labels";

function OpenFileForm() {
  const t = useT();
  const navigate = useNavigate();
  const [examRepo, setExamRepo] = useState("");
  const [workRepo, setWorkRepo] = useState("");
  const start = useActionMutation("start-probation");

  const examIsValid = normalizeRepoRef(examRepo) !== null;
  const workIsValid =
    workRepo.trim() === "" || normalizeRepoRef(workRepo) !== null;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!examIsValid || !workIsValid) return;
    start.mutate(
      { examRepo, ...(workRepo.trim() ? { workRepo } : {}) },
      {
        onSuccess: ({ id }) => navigate(probationPath(id)),
        onError: (error) =>
          toast.error(actionErrorMessage(error) ?? t("probation.home.failed")),
      },
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="exam-repo">{t("probation.home.examRepo")}</Label>
        <Input
          id="exam-repo"
          value={examRepo}
          onChange={(event) => setExamRepo(event.target.value)}
          placeholder="vercel/next.js"
          autoComplete="off"
          spellCheck={false}
          required
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="work-repo">{t("probation.home.workRepo")}</Label>
        <Input
          id="work-repo"
          value={workRepo}
          onChange={(event) => setWorkRepo(event.target.value)}
          placeholder="your-name/sandbox"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!workIsValid}
        />
        <p className="text-xs text-muted-foreground">
          {t("probation.home.workRepoHint")}
        </p>
      </div>
      <Button
        type="submit"
        className="justify-self-start"
        disabled={!examIsValid || !workIsValid || start.isPending}
      >
        {t("probation.home.start")}
      </Button>
    </form>
  );
}

export function ProbationsHome() {
  const t = useT();
  const { data: probations } = useActionQuery("list-probations", {});

  return (
    <div className="@container">
      <div className="mx-auto grid w-full max-w-5xl gap-12 px-6 py-12 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <section>
          <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-balance">
            {t("probation.home.headline")}
          </h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            {t("probation.home.lede")}
          </p>
          {probations && probations.length > 0 ? (
            <ul className="mt-10 divide-y divide-border border-y border-border">
              {probations.map((probation) => (
                <li key={probation.id}>
                  <Link
                    to={probationPath(probation.id)}
                    className="group flex items-center gap-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {probation.title}
                    </span>
                    <span className="tabular-nums text-sm text-muted-foreground">
                      {probation.examTotal > 0
                        ? formatPercent(
                            probation.examAnswered / probation.examTotal,
                          )
                        : t("probation.home.noExam")}
                    </span>
                    <IconArrowRight
                      className="size-4 text-muted-foreground transition-transform motion-safe:group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <aside>
          <OpenFileForm />
        </aside>
      </div>
    </div>
  );
}
