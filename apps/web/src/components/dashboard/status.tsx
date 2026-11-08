import type { Dictionary } from "@/i18n/dictionaries";
import type { DecisionStatus } from "@/lib/types";

const STYLE: Record<DecisionStatus, string> = {
  draft: "border-white/15 text-muted",
  submitted: "border-risk-moderate/40 text-risk-moderate",
  archived: "border-white/10 text-muted/70",
};

export function StatusBadge({
  status,
  d,
}: {
  status: DecisionStatus;
  d: Dictionary["dash"];
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium ${STYLE[status]}`}
    >
      {status === "submitted" && (
        <span
          className="size-1.5 animate-pulse rounded-full bg-risk-moderate"
          aria-hidden
        />
      )}
      {d.decisions.status[status]}
    </span>
  );
}

export function formatAmount(
  amount: string | null,
  currency: string | null,
  lang: string,
): string | null {
  if (amount === null) return null;
  try {
    return new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", {
      style: currency ? "currency" : "decimal",
      currency: currency ?? undefined,
      maximumFractionDigits: 0,
    }).format(Number(amount));
  } catch {
    return `${amount} ${currency ?? ""}`.trim();
  }
}
