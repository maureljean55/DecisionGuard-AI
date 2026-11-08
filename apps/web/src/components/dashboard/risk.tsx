/** Risk engine views: index, 5×5 heat map, scenarios. Server-safe (no hooks). */
import { Download, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/lib/format";
import { level, LEVEL_CHIP, LEVEL_FILL, LEVEL_TEXT } from "@/lib/risk";
import type {
  Analysis,
  RiskBreakdown,
  RiskComponent,
  RiskLevel,
  Scenario,
} from "@/lib/types";

import { ctaGhost, Eyebrow, HowToRead, Plate } from "./cockpit";

type D = Dictionary["dash"];
const COMPONENTS: RiskComponent[] = [
  "peak",
  "concentration",
  "breadth",
  "uncertainty",
];
const SCALE = [1, 2, 3, 4, 5] as const;
const CELL = {
  low: "bg-risk-low/[0.14] border-risk-low/25",
  moderate: "bg-risk-moderate/[0.14] border-risk-moderate/25",
  high: "bg-risk-high/[0.16] border-risk-high/30",
  critical: "bg-risk-critical/[0.18] border-risk-critical/35",
} as const;

export function IndexChip({
  d,
  score,
  levelKey,
}: {
  d: D;
  score: number | null | undefined;
  levelKey: RiskLevel | null | undefined;
}) {
  if (score === null || score === undefined || !levelKey)
    return <span className="text-xs text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-sm font-medium tabular-nums text-ink">
        {score}
        <span className="text-muted">/100</span>
      </span>
      <span
        className={`rounded-md border px-1.5 py-0.5 text-[0.68rem] font-medium ${LEVEL_CHIP[levelKey]}`}
      >
        {d.levels[levelKey]}
      </span>
    </span>
  );
}

export function RiskIndex({
  d,
  score,
  levelKey,
  breakdown,
}: {
  d: D;
  score: number;
  levelKey: RiskLevel;
  breakdown: RiskBreakdown;
}) {
  const R = d.risk;
  return (
    <div>
      <div className="flex items-end gap-3">
        <p
          className={`font-display text-[3.4rem] font-semibold leading-none tabular-nums ${LEVEL_TEXT[levelKey]}`}
        >
          {score}
          <span className="ml-1 font-sans text-lg font-normal text-muted">
            {R.of}
          </span>
        </p>
        <span
          className={`mb-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${LEVEL_CHIP[levelKey]}`}
        >
          {d.levels[levelKey]}
        </span>
      </div>
      <p className="mt-1.5 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
        {fmt(R.model, { model: breakdown.model })}
      </p>
      <ul className="mt-5 space-y-3">
        {COMPONENTS.map((k) => (
          <li key={k}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-ink" title={R.componentsHelp[k]}>
                {R.components[k]}{" "}
                <span className="text-muted">· {R.componentsHelp[k]}</span>
              </span>
              <span className="shrink-0 font-mono text-muted">
                {breakdown.components[k]} % × {breakdown.weights[k]}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-electric to-teal"
                style={{ width: `${breakdown.components[k]}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted">
        {fmt(R.counted, {
          n: String(breakdown.counted),
          x: String(breakdown.excluded),
        })}
      </p>
    </div>
  );
}

/** 5×5 grid; rows are impact (5 at the top), columns likelihood. */
export function Heatmap({
  d,
  matrix,
  href,
  selected,
}: {
  d: D;
  matrix: number[][];
  href?: (likelihood: number, impact: number) => string;
  selected?: { l: number; i: number } | null;
}) {
  const M = d.riskMap;
  return (
    <div className="flex gap-2">
      <span className="rotate-180 self-center font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted [writing-mode:vertical-rl]">
        {M.impact} →
      </span>
      <div className="min-w-0 flex-1">
        <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1">
          {[...SCALE].reverse().map((im) => (
            <div key={im} className="contents">
              <span
                className="flex items-center justify-end pr-1 font-mono text-[0.66rem] text-muted"
                title={M.scale.i[im - 1]}
              >
                {im}
              </span>
              {SCALE.map((li) => {
                const n = matrix[im - 1]?.[li - 1] ?? 0;
                const cls = `flex aspect-[4/3] items-center justify-center rounded-md border text-xs transition-colors ${CELL[level(li * im)]} ${
                  n ? "font-mono font-semibold text-ink" : "text-transparent"
                } ${
                  selected && selected.l === li && selected.i === im
                    ? "ring-2 ring-electric ring-offset-2 ring-offset-abyss"
                    : ""
                }`;
                const label = `${fmt(M.selected, { l: String(li), i: String(im) })} · ${fmt(M.cell, { n: String(n) })}`;
                return href ? (
                  <Link
                    key={li}
                    href={href(li, im)}
                    scroll={false}
                    aria-label={label}
                    className={`${cls} hover:brightness-150`}
                  >
                    {n || "·"}
                  </Link>
                ) : (
                  <span key={li} className={cls} aria-label={label}>
                    {n || "·"}
                  </span>
                );
              })}
            </div>
          ))}
          <span />
          {SCALE.map((li) => (
            <span
              key={li}
              className="pt-1 text-center font-mono text-[0.66rem] text-muted"
              title={M.scale.l[li - 1]}
            >
              {li}
            </span>
          ))}
        </div>
        <p className="mt-1.5 text-center font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted">
          {M.likelihood} →
        </p>
      </div>
    </div>
  );
}

export function Scenarios({ d, scenarios }: { d: D; scenarios: Scenario[] }) {
  const R = d.risk;
  return (
    <ul className="grid grid-cols-2 gap-2">
      {scenarios.map((s) => (
        <li
          key={s.key}
          className={`rounded-xl border p-3 ${s.key === "median" ? "border-electric/40 bg-electric/[0.07]" : "border-line bg-white/[0.02]"}`}
        >
          <p className="text-xs font-medium text-ink">{R.scenario[s.key]}</p>
          <p className="text-[0.68rem] text-muted">{R.scenarioHelp[s.key]}</p>
          <p className="mt-2 flex items-center gap-2">
            <span
              className={`font-display text-2xl font-semibold tabular-nums ${LEVEL_TEXT[s.level]}`}
            >
              {s.score}
            </span>
            <span className="h-1 flex-1 rounded-full bg-white/[0.06]">
              <span
                className={`block h-full rounded-full ${LEVEL_FILL[s.level]}`}
                style={{ width: `${s.score}%` }}
              />
            </span>
          </p>
        </li>
      ))}
    </ul>
  );
}

/** Risk section of a decision page, for a completed analysis. */
export function RiskPanel({
  d,
  lang,
  orgId,
  analysis,
}: {
  d: D;
  lang: string;
  orgId: string;
  analysis: Analysis;
}) {
  const R = d.risk;
  if (
    analysis.status !== "completed" ||
    analysis.risk_score === null ||
    !analysis.risk_level ||
    !analysis.risk_breakdown
  )
    return null;
  return (
    <Plate className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Eyebrow>{R.eyebrow}</Eyebrow>
          <h2 className="mt-1.5 font-display text-xl font-semibold text-ink">
            {R.title}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/orgs/${orgId}/analyses/${analysis.id}/report.pdf`}
            className={ctaGhost}
          >
            <Download className="size-4" aria-hidden />
            {R.pdf}
          </a>
          <Link
            href={`/${lang}/app/${orgId}/simulator?analysis=${analysis.id}`}
            className={ctaGhost}
          >
            <SlidersHorizontal className="size-4" aria-hidden />
            {R.simulate}
          </Link>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div>
          <RiskIndex
            d={d}
            score={analysis.risk_score}
            levelKey={analysis.risk_level}
            breakdown={analysis.risk_breakdown}
          />
          <HowToRead label={d.help.label} text={d.help.riskIndex} />
        </div>
        <div>
          <p className="mb-3 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
            {R.heatmap}
          </p>
          <Heatmap d={d} matrix={analysis.risk_breakdown.matrix} />
          <HowToRead label={d.help.label} text={d.help.heatmap} />
        </div>
        <div>
          <p className="mb-3 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
            {R.scenarios}
          </p>
          {analysis.scenarios && (
            <Scenarios d={d} scenarios={analysis.scenarios} />
          )}
          <HowToRead label={d.help.label} text={d.help.scenarios} />
        </div>
      </div>
      <p className="mt-6 text-[0.7rem] leading-relaxed text-muted">
        {R.method}
      </p>
    </Plate>
  );
}
