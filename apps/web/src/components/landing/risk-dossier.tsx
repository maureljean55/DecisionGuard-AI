import { ShieldCheck } from "lucide-react";
import type { CSSProperties } from "react";

import type { Dictionary } from "@/i18n/dictionaries";

type Level = "low" | "moderate" | "high" | "critical";
type Status = "fact" | "estimate" | "hypothesis";
type Category = keyof Dictionary["landing"]["dossier"]["categories"];

/** Same thresholds as the risk engine: 1–4 low, 5–9 moderate, 10–16 high, 17–25 critical. */
function levelOf(score: number): Level {
  if (score >= 17) return "critical";
  if (score >= 10) return "high";
  if (score >= 5) return "moderate";
  return "low";
}

// Illustrative example only. Probability and impact on the 1–5 scale.
// `label` indexes the localized risk titles (dictionary: landing.dossier.risks).
const RISKS: { label: number; p: number; i: number; category: Category; status: Status; note?: "fx" }[] = [
  { label: 0, p: 4, i: 5, category: "operations", status: "hypothesis" },
  { label: 1, p: 4, i: 4, category: "finance", status: "estimate" },
  { label: 2, p: 4, i: 3, category: "legal", status: "hypothesis" },
  { label: 5, p: 1, i: 3, category: "finance", status: "fact", note: "fx" },
];

const LEVEL_DOT: Record<Level, string> = {
  low: "bg-risk-low",
  moderate: "bg-risk-moderate",
  high: "bg-risk-high",
  critical: "bg-risk-critical",
};
const LEVEL_TEXT: Record<Level, string> = {
  low: "text-risk-low",
  moderate: "text-risk-moderate",
  high: "text-risk-high",
  critical: "text-risk-critical",
};
// Cell tints: risk colour at low opacity, so the matrix reads at a glance without shouting.
const LEVEL_CELL: Record<Level, string> = {
  low: "bg-risk-low/[0.16]",
  moderate: "bg-risk-moderate/[0.16]",
  high: "bg-risk-high/[0.20]",
  critical: "bg-risk-critical/[0.30]",
};
const STATUS_STYLE: Record<Status, string> = {
  fact: "border-teal/40 text-teal",
  estimate: "border-iris/50 text-[#9aa6ff]",
  hypothesis: "border-violet/50 text-violet",
};

const delay = (s: number) => ({ "--delay": `${s}s` }) as CSSProperties;

export function RiskDossier({ d }: { d: Dictionary["landing"]["dossier"] }) {
  const step = 0.28;
  const start = 0.5;
  const sealAt = start + RISKS.length * step + 0.3;

  return (
    <figure className="relative overflow-hidden rounded-[22px] border border-white/10 bg-abyss/90 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)]">
      {/* Header of the dossier */}
      <figcaption className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-4 sm:px-6">
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-muted">{d.kind}</p>
          <p className="mt-1 font-display text-2xl font-semibold leading-tight text-ink">{d.title}</p>
          <p className="mt-1 text-xs text-muted">{d.meta}</p>
        </div>
        <span className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-muted">
          {d.label}
        </span>
      </figcaption>

      <div className="grid items-start gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
        {/* 5×5 matrix — probability on the vertical axis, impact on the horizontal one. */}
        <div className="mx-auto flex w-full max-w-[15rem] gap-2" aria-hidden>
          <span className="flex items-center pb-6 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted [writing-mode:vertical-rl] rotate-180">
            {d.probability} →
          </span>
          <div className="flex-1">
            <div className="relative aspect-square">
              <div className="grid h-full grid-cols-5 grid-rows-5 gap-[3px]">
                {[5, 4, 3, 2, 1].flatMap((p) =>
                  [1, 2, 3, 4, 5].map((i) => (
                    <div key={`${p}-${i}`} className={`rounded-[5px] ${LEVEL_CELL[levelOf(p * i)]}`} />
                  )),
                )}
              </div>
              {/* The owl's gaze: a single sweep over the matrix as the analysis runs. */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[5px]">
                <div className="dg-scan h-full w-full bg-gradient-to-b from-transparent via-teal/15 to-transparent" />
              </div>
              {RISKS.map((r, idx) => (
                <span
                  key={idx}
                  className={`dg-pop absolute flex size-[22px] items-center justify-center rounded-full font-mono text-[0.65rem] font-medium text-night ring-2 ring-abyss ${LEVEL_DOT[levelOf(r.p * r.i)]}`}
                  style={{
                    left: `${(r.i - 0.5) * 20}%`,
                    top: `${(5 - r.p + 0.5) * 20}%`,
                    transform: "translate(-50%, -50%)",
                    ...delay(start + idx * step),
                  }}
                >
                  {idx + 1}
                </span>
              ))}
            </div>
            <p className="mt-2 text-right font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">
              {d.impact} →
            </p>
          </div>
        </div>

        {/* Risk register */}
        <ol className="space-y-2.5">
          {RISKS.map((r, idx) => {
            const score = r.p * r.i;
            const level = levelOf(score);
            return (
              <li
                key={idx}
                className="dg-rise grid grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                style={delay(start + idx * step)}
              >
                <span
                  className={`mt-0.5 flex size-[22px] items-center justify-center rounded-full font-mono text-[0.65rem] font-medium text-night ${LEVEL_DOT[level]}`}
                  aria-hidden
                >
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-snug text-ink">{d.risks[r.label]}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] text-muted">
                    <span>{d.categories[r.category]}</span>
                    <span
                      className={`rounded-full border px-1.5 py-px font-mono text-[0.6rem] uppercase tracking-wide ${STATUS_STYLE[r.status]}`}
                    >
                      {d.status[r.status]}
                    </span>
                    {r.note && <span className="italic">{d.notes[r.note]}</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xs text-muted">
                    {r.p}×{r.i}=<span className="text-sm font-medium text-ink">{score}</span>
                  </p>
                  <p className={`mt-0.5 text-[0.68rem] font-semibold ${LEVEL_TEXT[level]}`}>
                    {d.levels[level]}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Audit seal: the last thing to appear, as in the real workflow. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] px-5 py-4 sm:px-6">
        <div className="dg-seal flex items-center gap-2.5" style={delay(sealAt)}>
          <span className="flex size-9 items-center justify-center rounded-full border border-teal/50 bg-teal/10">
            <ShieldCheck className="size-4 text-teal" aria-hidden />
          </span>
          <span className="text-sm font-semibold text-ink">{d.seal}</span>
        </div>
        <p className="dg-rise text-xs text-muted" style={delay(sealAt + 0.15)}>
          {d.sealNote}
        </p>
      </div>
    </figure>
  );
}
