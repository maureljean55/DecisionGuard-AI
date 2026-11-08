import type { Dictionary } from "@/i18n/dictionaries";
import type { AnalysisSummary, DecisionStatus } from "@/lib/types";

const STYLE: Record<DecisionStatus, string> = {
  draft: "border-white/15 text-muted",
  submitted: "border-risk-moderate/40 text-risk-moderate",
  archived: "border-white/10 text-muted/70",
};

const ANALYSIS_STYLE: Record<string, string> = {
  collecting_info: "border-risk-moderate/40 text-risk-moderate",
  pending: "border-iris/50 text-[#9aa6ff]",
  analyzing: "border-iris/50 text-[#9aa6ff]",
  simulating: "border-iris/50 text-[#9aa6ff]",
  verifying: "border-iris/50 text-[#9aa6ff]",
  reporting: "border-iris/50 text-[#9aa6ff]",
  completed: "border-teal/40 text-teal",
  failed: "border-risk-critical/50 text-risk-critical",
};

export function StatusBadge({
  status,
  d,
  analysis,
}: {
  status: DecisionStatus;
  d: Dictionary["dash"];
  analysis?: AnalysisSummary | null;
}) {
  // A submitted decision is best described by the state of its analysis.
  if (status === "submitted" && analysis && analysis.status !== "canceled") {
    const pulse = !["completed", "failed"].includes(analysis.status);
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium ${ANALYSIS_STYLE[analysis.status]}`}
      >
        {pulse && (
          <span
            className="size-1.5 animate-pulse rounded-full bg-current"
            aria-hidden
          />
        )}
        {d.analysis.status[analysis.status]}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium ${STYLE[status]}`}
    >
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
