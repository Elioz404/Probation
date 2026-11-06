import {
  actionErrorMessage,
  useActionMutation,
} from "@agent-native/core/client/hooks";
import { useT } from "@agent-native/core/client/i18n";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { formatPercent, useTrustLabels } from "./labels";
import type { Promotion } from "./types";

function PromotionRequest({
  probationId,
  promotion,
}: {
  probationId: string;
  promotion: Promotion;
}) {
  const t = useT();
  const labels = useTrustLabels();
  const decide = useActionMutation("decide-promotion");
  const { evidence } = promotion;

  function submit(decision: "sign" | "decline") {
    decide.mutate(
      { probationId, requestId: promotion.id, decision },
      {
        onError: (error) =>
          toast.error(
            actionErrorMessage(error) ?? t("probation.promotion.failed"),
          ),
      },
    );
  }

  return (
    <li className="grid gap-3 py-4 @2xl:grid-cols-[minmax(0,1fr)_auto] @2xl:items-start">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">
          {labels.action(promotion.action)} ·{" "}
          {labels.context(promotion.context)}:{" "}
          {labels.level(promotion.fromLevel)} →{" "}
          {labels.level(promotion.toLevel)}
        </h3>
        {/* Agent-written text, rendered as plain text. */}
        <blockquote className="mt-1 text-sm text-pretty">
          {promotion.argument}
        </blockquote>
        <p className="mt-1 text-xs tabular-nums text-muted-foreground">
          {t("probation.promotion.evidence", {
            cases: evidence.cases,
            accuracy: formatPercent(evidence.accuracy),
            defensible: formatPercent(evidence.defensibleAccuracy),
            bar: formatPercent(evidence.bar),
          })}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={decide.isPending}
          onClick={() => submit("sign")}
        >
          {t("probation.promotion.sign")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={decide.isPending}
          onClick={() => submit("decline")}
        >
          {t("probation.promotion.decline")}
        </Button>
      </div>
    </li>
  );
}

export function PromotionDesk({
  probationId,
  promotions,
}: {
  probationId: string;
  promotions: readonly Promotion[];
}) {
  const t = useT();
  const pending = promotions.filter(({ status }) => status === "pending");
  if (pending.length === 0) return null;
  return (
    <section
      aria-label={t("probation.promotion.title")}
      className="promotion-desk rounded-lg border border-border px-4"
    >
      <h2 className="pt-3 text-sm font-semibold">
        {t("probation.promotion.waiting", { count: pending.length })}
      </h2>
      <ul className="divide-y divide-border">
        {pending.map((promotion) => (
          <PromotionRequest
            key={promotion.id}
            probationId={probationId}
            promotion={promotion}
          />
        ))}
      </ul>
    </section>
  );
}
