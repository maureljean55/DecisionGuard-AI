/**
 * Charts built from stored data. Server-safe SVG/HTML: every mark has a native tooltip and
 * keyboard focus, and every chart has a data-table twin ("Show data").
 *
 * Categorical slots (validated on the #0d1426 surface): blue #3478f6, teal #22a6ad,
 * violet #a46bff; neutral gray for "not established" (uncertainty, assumptions).
 * Risk-level colours are status colours and only ever encode a risk level.
 */
import type { ReactNode } from "react";

import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/lib/format";
import { level, LEVEL_FILL, type Level } from "@/lib/risk";
import type { RiskBreakdown, RiskComponent } from "@/lib/types";

import { HowToRead, Plate } from "./cockpit";

type D = Dictionary["dash"];
const C = {
  blue: "#3478f6",
  teal: "#22a6ad",
  violet: "#a46bff",
  gray: "#64748b",
  warm: "#d95926",
};
const LEVEL_HEX: Record<Level, string> = {
  low: "#2f9e6e",
  moderate: "#d9a521",
  high: "#e07b2a",
  critical: "#d23c55",
};
const LEVELS: Level[] = ["low", "moderate", "high", "critical"];

const num = (lang: string, v: number, digits = 0) =>
  new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(v);

export function ChartCard({
  title,
  subtitle,
  table,
  tableLabel,
  help,
  children,
}: {
  title: string;
  subtitle?: string;
  help?: { label: string; text: string };
  table?: { head: string[]; rows: (string | number)[][] };
  tableLabel: string;
  children: ReactNode;
}) {
  return (
    <Plate className="flex flex-col p-5 sm:p-6">
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {subtitle && (
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{subtitle}</p>
      )}
      {help && <HowToRead label={help.label} text={help.text} />}
      <div className="mt-4 flex-1">{children}</div>
      {table && table.rows.length > 0 && (
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer text-muted hover:text-ink">
            {tableLabel}
          </summary>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-muted">
                  {table.head.map((h) => (
                    <th key={h} className="py-1.5 pr-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td
                        key={j}
                        className={`py-1.5 pr-3 ${j ? "font-mono tabular-nums" : ""} text-ink/90`}
                      >
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </Plate>
  );
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="inline-block size-2.5 shrink-0 rounded-sm"
      style={{ background: color }}
    />
  );
}

// ---------------------------------------------------------------- 1. score breakdown

const PARTS: { key: RiskComponent; color: string }[] = [
  { key: "peak", color: C.blue },
  { key: "concentration", color: C.teal },
  { key: "breadth", color: C.violet },
  { key: "uncertainty", color: C.gray },
];

export function ScoreBreakdown({
  d,
  lang,
  score,
  breakdown,
}: {
  d: D;
  lang: string;
  score: number;
  breakdown: RiskBreakdown;
}) {
  const T = d.charts.breakdown;
  const parts = PARTS.map((p) => ({
    ...p,
    label: d.risk.components[p.key],
    pct: breakdown.components[p.key],
    w: breakdown.weights[p.key],
    pts: breakdown.components[p.key] * breakdown.weights[p.key],
  }));
  const total = parts.reduce((s, p) => s + p.pts, 0);
  const sev = (
    breakdown.per_agent ? Object.values(breakdown.per_agent) : []
  ) as number[];
  const max = sev.length ? Math.max(...sev) : 0;
  let serious = 0;
  breakdown.matrix.forEach((row, i) =>
    row.forEach((n, l) => {
      if ((i + 1) * (l + 1) >= 10) serious += n;
    }),
  );
  const explain: Record<RiskComponent, string> = {
    peak: fmt(T.explain.peak, { max: String(max) }),
    concentration: T.explain.concentration,
    breadth: fmt(T.explain.breadth, {
      n: String(serious),
      total: String(breakdown.counted),
    }),
    uncertainty: T.explain.uncertainty,
  };
  return (
    <ChartCard
      help={{ label: d.help.label, text: d.help.breakdown }}
      title={T.title}
      subtitle={T.subtitle}
      tableLabel={d.charts.table}
      table={{
        head: [T.col.part, T.col.value, T.col.weight, T.col.points],
        rows: parts.map((p) => [
          p.label,
          `${p.pct} %`,
          num(lang, p.w, 2),
          num(lang, p.pts, 1),
        ]),
      }}
    >
      <div
        className="flex h-7 gap-[2px] overflow-hidden rounded-md bg-white/[0.04]"
        role="img"
        aria-label={`${T.title} : ${score}/100`}
      >
        {parts.map((p) =>
          p.pts > 0 ? (
            <span
              key={p.key}
              tabIndex={0}
              title={fmt(T.line, {
                label: p.label,
                pct: String(p.pct),
                w: num(lang, p.w, 2),
                pts: num(lang, p.pts, 1),
              })}
              className="h-full outline-none first:rounded-l-md focus-visible:ring-2 focus-visible:ring-ink"
              style={{ width: `${p.pts}%`, background: p.color }}
            />
          ) : null,
        )}
        <span className="flex-1" title={T.rest} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[0.62rem] text-muted">
        <span>0</span>
        <span>100</span>
      </div>
      <ul className="mt-4 space-y-2.5">
        {parts.map((p) => (
          <li key={p.key} className="flex gap-2.5 text-xs leading-relaxed">
            <span className="mt-1">
              <Swatch color={p.color} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-ink">
                {p.label}{" "}
                <span className="font-mono text-muted">
                  {p.pct} % × {num(lang, p.w, 2)} ={" "}
                </span>
                <span className="font-mono font-medium">
                  {num(lang, p.pts, 1)} pts
                </span>
              </span>
              <span className="block text-muted">{explain[p.key]}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-lg border border-line bg-night/50 px-3 py-2 font-mono text-xs text-ink">
        {fmt(T.sum, {
          parts: parts.map((p) => num(lang, p.pts, 1)).join(" + "),
          total: num(lang, total, 1),
          score: String(score),
        })}
      </p>
    </ChartCard>
  );
}

// ---------------------------------------------------------------- 2. risk by domain

export function DomainBars({
  d,
  rows,
}: {
  d: D;
  rows: { agent: string; max: number; count: number }[];
}) {
  const T = d.charts.domains;
  const sorted = [...rows].sort((a, b) => b.max - a.max || b.count - a.count);
  const name = (k: string) =>
    d.agentCatalog[k as keyof typeof d.agentCatalog]?.name ?? k;
  return (
    <ChartCard
      help={{ label: d.help.label, text: d.help.domains }}
      title={T.title}
      subtitle={T.subtitle}
      tableLabel={d.charts.table}
      table={{
        head: [T.col.agent, T.col.max, T.col.count],
        rows: sorted.map((r) => [name(r.agent), `${r.max}/25`, r.count]),
      }}
    >
      <ul className="space-y-3">
        {sorted.map((r) => {
          const lv = level(r.max);
          return (
            <li
              key={r.agent}
              tabIndex={0}
              title={`${name(r.agent)} · ${r.max}/25 · ${d.levels[lv]} · ${fmt(T.count, { n: String(r.count) })}`}
              className="rounded outline-none focus-visible:ring-2 focus-visible:ring-electric"
            >
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-ink">{name(r.agent)}</span>
                <span className="text-muted">
                  <span className="font-mono text-ink">{r.max}/25</span> ·{" "}
                  {d.levels[lv]} · {fmt(T.count, { n: String(r.count) })}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-white/[0.05]">
                <div
                  className={`h-full rounded-r-[4px] ${LEVEL_FILL[lv]}`}
                  style={{ width: `${(r.max / 25) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}

// ---------------------------------------------------------------- 3. sensitivity (tornado)

export function Tornado({
  d,
  rows,
}: {
  d: D;
  rows: { agent: string; down: number; up: number; base: number }[];
}) {
  const T = d.charts.tornado;
  if (!rows.length) return null;
  const base = rows[0].base;
  const lo = Math.min(...rows.map((r) => r.down), base) - 2;
  const hi = Math.max(...rows.map((r) => r.up), base) + 2;
  const x = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const name = (k: string) =>
    d.agentCatalog[k as keyof typeof d.agentCatalog]?.name ?? k;
  return (
    <ChartCard
      help={{ label: d.help.label, text: d.help.tornado }}
      title={T.title}
      subtitle={T.subtitle}
      tableLabel={d.charts.table}
      table={{
        head: [T.col.agent, T.col.down, T.col.up, T.col.swing],
        rows: rows.map((r) => [name(r.agent), r.down, r.up, r.up - r.down]),
      }}
    >
      <div className="mb-2 flex justify-between text-[0.68rem]">
        <span className="flex items-center gap-1.5 text-muted">
          <Swatch color={C.blue} /> {T.down}
        </span>
        <span className="font-mono text-ink">
          {fmt(T.base, { n: String(base) })}
        </span>
        <span className="flex items-center gap-1.5 text-muted">
          {T.up} <Swatch color={C.warm} />
        </span>
      </div>
      <ul className="relative space-y-1.5">
        <span
          aria-hidden
          className="absolute inset-y-0 w-px bg-ink/50"
          style={{ left: `calc(6.5rem + (100% - 6.5rem) * ${x(base) / 100})` }}
        />
        {rows.map((r) => (
          <li
            key={r.agent}
            tabIndex={0}
            title={`${name(r.agent)} : ${r.down} ← ${base} → ${r.up}`}
            className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-electric"
          >
            <span className="truncate pr-2 text-xs text-ink">
              {name(r.agent)}
            </span>
            <span className="relative h-5">
              <span
                className="absolute top-1 h-3 rounded-l-[4px]"
                style={{
                  left: `${x(r.down)}%`,
                  width: `calc(${x(base) - x(r.down)}% - 1px)`,
                  background: C.blue,
                }}
              />
              <span
                className="absolute top-1 h-3 rounded-r-[4px]"
                style={{
                  left: `calc(${x(base)}% + 1px)`,
                  width: `calc(${x(r.up) - x(base)}% - 1px)`,
                  background: C.warm,
                }}
              />
              <span
                className="absolute top-0.5 font-mono text-[0.62rem] text-muted"
                style={{ right: `calc(${100 - x(r.down)}% + 4px)` }}
              >
                {r.down}
              </span>
              <span
                className="absolute top-0.5 font-mono text-[0.62rem] text-muted"
                style={{ left: `calc(${x(r.up)}% + 4px)` }}
              >
                {r.up}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

// ---------------------------------------------------------------- 4. score history

export function ScoreHistory({
  d,
  lang,
  points,
}: {
  d: D;
  lang: string;
  points: { at: string; score: number }[];
}) {
  const T = d.charts.history;
  const date = (iso: string) =>
    new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(iso));
  const W = 320;
  const H = 150;
  const pad = { l: 26, r: 10, t: 10, b: 22 };
  const px = (i: number) =>
    pad.l +
    (points.length === 1 ? 0.5 : i / (points.length - 1)) * (W - pad.l - pad.r);
  const py = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  return (
    <ChartCard
      help={{ label: d.help.label, text: d.help.history }}
      title={T.title}
      subtitle={T.subtitle}
      tableLabel={d.charts.table}
      table={{
        head: [T.col.date, T.col.score],
        rows: points.map((p) => [date(p.at), p.score]),
      }}
    >
      {points.length < 2 ? (
        <p className="text-sm leading-relaxed text-muted">{T.single}</p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={T.title}
        >
          {[0, 25, 45, 65, 100].map((g) => (
            <g key={g}>
              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={py(g)}
                y2={py(g)}
                stroke="rgba(255,255,255,0.07)"
              />
              <text
                x={pad.l - 5}
                y={py(g)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted font-mono"
                style={{ fontSize: 8 }}
              >
                {g}
              </text>
            </g>
          ))}
          <polyline
            fill="none"
            stroke={C.blue}
            strokeWidth="2"
            strokeLinejoin="round"
            points={points.map((p, i) => `${px(i)},${py(p.score)}`).join(" ")}
          />
          {points.map((p, i) => (
            <g key={i} tabIndex={0}>
              <title>{`${date(p.at)} · ${p.score}/100`}</title>
              <circle cx={px(i)} cy={py(p.score)} r="12" fill="transparent" />
              <circle
                cx={px(i)}
                cy={py(p.score)}
                r="4"
                fill={LEVEL_HEX[level25(p.score)]}
                stroke="#0d1426"
                strokeWidth="2"
              />
              <text
                x={px(i)}
                y={H - 6}
                textAnchor="middle"
                className="fill-muted"
                style={{ fontSize: 8 }}
              >
                {date(p.at)}
              </text>
              {i === points.length - 1 && (
                <text
                  x={px(i)}
                  y={py(p.score) - 9}
                  textAnchor="middle"
                  className="fill-ink font-mono"
                  style={{ fontSize: 9 }}
                >
                  {p.score}
                </text>
              )}
            </g>
          ))}
        </svg>
      )}
    </ChartCard>
  );
}

/** Level of an index out of 100 (engine thresholds 25 / 45 / 65). */
export function level25(score: number): Level {
  if (score >= 65) return "critical";
  if (score >= 45) return "high";
  if (score >= 25) return "moderate";
  return "low";
}

// ---------------------------------------------------------------- 5. portfolio map

export function PortfolioMap({
  d,
  lang,
  currency,
  items,
  excluded,
  hrefFor,
}: {
  d: D;
  lang: string;
  currency: string;
  items: {
    id: string;
    title: string;
    amount: number;
    score: number;
    findings: number;
  }[];
  excluded: number;
  hrefFor: (id: string) => string;
}) {
  const T = d.charts.portfolio;
  const W = 420;
  const H = 230;
  const pad = { l: 30, r: 14, t: 10, b: 30 };
  const amounts = items.map((i) => i.amount);
  // One decade of margin around the data, at least two decades wide.
  const minA = Math.max(
    10 ** Math.floor(Math.log10(Math.min(...amounts)) - 0.5),
    1,
  );
  const maxA = Math.max(
    10 ** Math.ceil(Math.log10(Math.max(...amounts)) + 0.5),
    minA * 100,
  );
  const lx = (v: number) =>
    pad.l +
    ((Math.log10(v) - Math.log10(minA)) /
      (Math.log10(maxA) - Math.log10(minA))) *
      (W - pad.l - pad.r);
  const py = (v: number) => pad.t + (1 - v / 100) * (H - pad.t - pad.b);
  const maxF = Math.max(...items.map((i) => i.findings), 1);
  const r = (n: number) => 5 + Math.sqrt(n / maxF) * 11;
  const money = (v: number) =>
    new Intl.NumberFormat(lang === "fr" ? "fr-FR" : "en-GB", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(v);
  const decades: number[] = [];
  for (
    let e = Math.ceil(Math.log10(minA));
    e <= Math.floor(Math.log10(maxA));
    e++
  )
    decades.push(10 ** e);
  const labelled = new Set(
    [...items]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((i) => i.id),
  );
  return (
    <ChartCard
      help={{ label: d.help.label, text: d.help.portfolio }}
      title={T.title}
      subtitle={T.subtitle}
      tableLabel={d.charts.table}
      table={{
        head: [T.col.title, T.col.amount, T.col.index, T.col.findings],
        rows: items.map((i) => [
          i.title,
          `${money(i.amount)} ${currency}`,
          i.score,
          i.findings,
        ]),
      }}
    >
      {items.length === 0 ? (
        <p className="text-sm text-muted">{d.charts.noData}</p>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={T.title}
        >
          {/* Level bands, from the engine's thresholds */}
          {(
            [
              [0, 25, "low"],
              [25, 45, "moderate"],
              [45, 65, "high"],
              [65, 100, "critical"],
            ] as const
          ).map(([a, b, lv]) => (
            <g key={lv}>
              <rect
                x={pad.l}
                width={W - pad.l - pad.r}
                y={py(b)}
                height={py(a) - py(b)}
                fill={LEVEL_HEX[lv]}
                opacity="0.06"
              />
              <text
                x={pad.l + 4}
                y={py(b) + 9}
                className="fill-muted"
                style={{ fontSize: 7.5 }}
              >
                {d.levels[lv]}
              </text>
            </g>
          ))}
          {[0, 25, 45, 65, 100].map((g) => (
            <text
              key={g}
              x={pad.l - 5}
              y={py(g)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted font-mono"
              style={{ fontSize: 8 }}
            >
              {g}
            </text>
          ))}
          {decades.map((v) => (
            <g key={v}>
              <line
                x1={lx(v)}
                x2={lx(v)}
                y1={pad.t}
                y2={H - pad.b}
                stroke="rgba(255,255,255,0.06)"
              />
              <text
                x={lx(v)}
                y={H - pad.b + 11}
                textAnchor="middle"
                className="fill-muted font-mono"
                style={{ fontSize: 8 }}
              >
                {money(v)}
              </text>
            </g>
          ))}
          <text
            x={(W + pad.l) / 2}
            y={H - 3}
            textAnchor="middle"
            className="fill-muted"
            style={{ fontSize: 8 }}
          >
            {fmt(T.amount, { cur: currency })}
          </text>
          {items.map((i) => (
            <a
              key={i.id}
              href={hrefFor(i.id)}
              aria-label={`${i.title} · ${i.score}/100`}
            >
              <title>{`${i.title} · ${money(i.amount)} ${currency} · ${i.score}/100 · ${i.findings}`}</title>
              <circle
                cx={lx(i.amount)}
                cy={py(i.score)}
                r={r(i.findings) + 6}
                fill="transparent"
              />
              <circle
                cx={lx(i.amount)}
                cy={py(i.score)}
                r={r(i.findings)}
                fill={C.blue}
                fillOpacity="0.75"
                stroke="#0d1426"
                strokeWidth="2"
              />
              {labelled.has(i.id) && (
                <text
                  x={lx(i.amount)}
                  y={py(i.score) - r(i.findings) - 4}
                  textAnchor={
                    lx(i.amount) > W * 0.7
                      ? "end"
                      : lx(i.amount) < W * 0.3
                        ? "start"
                        : "middle"
                  }
                  className="fill-ink"
                  style={{ fontSize: 8.5 }}
                >
                  {i.title.length > 26 ? `${i.title.slice(0, 25)}…` : i.title}
                </text>
              )}
            </a>
          ))}
        </svg>
      )}
      {excluded > 0 && (
        <p className="mt-2 text-[0.7rem] text-muted">
          {fmt(T.excluded, { n: String(excluded) })}
        </p>
      )}
    </ChartCard>
  );
}

// ---------------------------------------------------------------- 6. levels breakdown

export function LevelDistribution({
  d,
  counts,
}: {
  d: D;
  counts: Record<Level, number>;
}) {
  const T = d.charts.levelsChart;
  const max = Math.max(...LEVELS.map((l) => counts[l]), 1);
  return (
    <ChartCard
      help={{ label: d.help.label, text: d.help.levels }}
      title={T.title}
      subtitle={T.subtitle}
      tableLabel={d.charts.table}
      table={{
        head: [T.col.level, T.col.count],
        rows: LEVELS.map((l) => [d.levels[l], counts[l]]),
      }}
    >
      <ul className="space-y-3">
        {[...LEVELS].reverse().map((l) => (
          <li
            key={l}
            tabIndex={0}
            title={`${d.levels[l]} · ${counts[l]}`}
            className="grid grid-cols-[5.5rem_minmax(0,1fr)_2rem] items-center gap-3 rounded outline-none focus-visible:ring-2 focus-visible:ring-electric"
          >
            <span className="flex items-center gap-2 text-xs text-ink">
              <Swatch color={LEVEL_HEX[l]} />
              {d.levels[l]}
            </span>
            <span className="h-2.5 rounded-full bg-white/[0.05]">
              {counts[l] > 0 && (
                <span
                  className="block h-full rounded-r-[4px]"
                  style={{
                    width: `${(counts[l] / max) * 100}%`,
                    background: LEVEL_HEX[l],
                  }}
                />
              )}
            </span>
            <span className="text-right font-mono text-xs text-ink">
              {counts[l]}
            </span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

// ---------------------------------------------------------------- 7. evidence quality

function Segmented({
  label,
  parts,
}: {
  label: string;
  parts: { key: string; label: string; n: number; color: string }[];
}) {
  const total = parts.reduce((s, p) => s + p.n, 0) || 1;
  return (
    <div>
      <p className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <div className="mt-2 flex h-3 gap-[2px] overflow-hidden rounded-[4px]">
        {parts.map((p) =>
          p.n ? (
            <span
              key={p.key}
              tabIndex={0}
              title={`${p.label} · ${p.n} (${Math.round((p.n / total) * 100)} %)`}
              className="h-full outline-none focus-visible:ring-2 focus-visible:ring-ink"
              style={{ width: `${(p.n / total) * 100}%`, background: p.color }}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <Swatch color={p.color} />
            {p.label}
            <span className="font-mono text-ink">{p.n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EvidenceQuality({
  d,
  evidence,
  audit,
}: {
  d: D;
  evidence: Record<
    "fact" | "estimate" | "assumption" | "ai_hypothesis",
    number
  >;
  audit: Record<"supported" | "weak" | "unsupported" | "none", number>;
}) {
  const T = d.charts.evidence;
  const ev = [
    {
      key: "fact",
      label: d.results.evidence.fact,
      n: evidence.fact,
      color: C.teal,
    },
    {
      key: "estimate",
      label: d.results.evidence.estimate,
      n: evidence.estimate,
      color: C.blue,
    },
    {
      key: "ai_hypothesis",
      label: d.results.evidence.ai_hypothesis,
      n: evidence.ai_hypothesis,
      color: C.violet,
    },
    {
      key: "assumption",
      label: d.results.evidence.assumption,
      n: evidence.assumption,
      color: C.gray,
    },
  ];
  // Audit verdicts are a quality state: status colours, always with their label.
  const au = [
    {
      key: "supported",
      label: d.audit.verdict.supported,
      n: audit.supported,
      color: LEVEL_HEX.low,
    },
    {
      key: "weak",
      label: d.audit.verdict.weak,
      n: audit.weak,
      color: LEVEL_HEX.moderate,
    },
    {
      key: "unsupported",
      label: d.audit.verdict.unsupported,
      n: audit.unsupported,
      color: LEVEL_HEX.critical,
    },
    { key: "none", label: d.audit.none, n: audit.none, color: C.gray },
  ];
  const total = ev.reduce((s, p) => s + p.n, 0);
  return (
    <ChartCard
      help={{ label: d.help.label, text: d.help.evidence }}
      title={T.title}
      subtitle={T.subtitle}
      tableLabel={d.charts.table}
      table={{
        head: [T.col.kind, T.col.count, T.col.share],
        rows: [...ev, ...au].map((p) => [
          p.label,
          p.n,
          `${total ? Math.round((p.n / total) * 100) : 0} %`,
        ]),
      }}
    >
      {total === 0 ? (
        <p className="text-sm text-muted">{d.charts.noData}</p>
      ) : (
        <div className="space-y-5">
          <Segmented label={T.basis} parts={ev} />
          <Segmented label={T.audit} parts={au} />
        </div>
      )}
    </ChartCard>
  );
}

// ---------------------------------------------------------------- 8. activity

export function ActivityBars({
  d,
  lang,
  months,
  limit,
}: {
  d: D;
  lang: string;
  months: { month: string; count: number }[]; // month = "YYYY-MM"
  limit: number | null;
}) {
  const T = d.charts.activity;
  const label = (m: string) =>
    new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${m}-01T00:00:00Z`));
  const top = Math.max(...months.map((m) => m.count), limit ?? 0, 1);
  return (
    <ChartCard
      help={{ label: d.help.label, text: d.help.activity }}
      title={T.title}
      subtitle={T.subtitle}
      tableLabel={d.charts.table}
      table={{
        head: [T.col.month, T.col.count],
        rows: months.map((m) => [label(m.month), m.count]),
      }}
    >
      <div className="relative flex h-32 items-end gap-2 border-b border-line">
        {limit !== null && (
          <span
            className="absolute inset-x-0 border-t border-ink/40"
            style={{ bottom: `${(limit / top) * 100}%` }}
          >
            <span className="absolute -top-4 right-0 font-mono text-[0.62rem] text-muted">
              {fmt(T.quota, { n: String(limit) })}
            </span>
          </span>
        )}
        {months.map((m) => (
          <span
            key={m.month}
            tabIndex={0}
            title={`${label(m.month)} · ${m.count}`}
            className="flex h-full flex-1 flex-col justify-end outline-none focus-visible:ring-2 focus-visible:ring-electric"
          >
            {m.count > 0 && (
              <span
                className="mx-auto w-full max-w-8 rounded-t-[4px]"
                style={{
                  height: `${(m.count / top) * 100}%`,
                  background: C.blue,
                }}
              />
            )}
          </span>
        ))}
      </div>
      <div className="mt-1.5 flex gap-2">
        {months.map((m) => (
          <span
            key={m.month}
            className="flex-1 text-center text-[0.66rem] text-muted"
          >
            {label(m.month)}
            <span className="block font-mono text-ink">{m.count}</span>
          </span>
        ))}
      </div>
    </ChartCard>
  );
}
