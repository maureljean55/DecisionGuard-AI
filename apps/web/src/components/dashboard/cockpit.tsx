/** Visual building blocks of the cockpit-style dashboard. Server-safe (no hooks). */
import type { ComponentType, ReactNode } from "react";

import type { Dictionary } from "@/i18n/dictionaries";
import { level, LEVEL_CHIP } from "@/lib/risk";

type D = Dictionary["dash"];
type Icon = ComponentType<{ className?: string }>;

/** Primary action: the one gradient on the page. */
export const ctaPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-electric to-teal px-4 py-2.5 text-sm font-semibold text-night shadow-[0_0_24px_-6px_rgba(52,120,246,0.6)] transition-[filter] hover:brightness-110";
export const ctaGhost =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white/[0.03] px-3.5 py-2.5 text-sm text-ink transition-colors hover:bg-white/[0.07]";

export function Eyebrow({
  children,
  live,
}: {
  children: ReactNode;
  live?: boolean;
}) {
  return (
    <p className="flex items-center gap-2 font-mono text-[0.68rem] font-medium uppercase tracking-[0.14em] text-teal">
      {live && (
        <span className="size-1.5 rounded-full bg-teal shadow-[0_0_8px_var(--teal)]" />
      )}
      {children}
    </p>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
      <div className="min-w-0 max-w-2xl">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-2 font-display text-[2rem] font-semibold leading-tight text-ink sm:text-[2.5rem]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-sm leading-relaxed text-muted sm:text-[0.95rem]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Plate({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-line bg-abyss/80 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] ${className}`}
    >
      {children}
    </section>
  );
}

export function KpiTile({
  label,
  value,
  unit,
  sub,
  icon: IconCmp,
  tone = "text-ink",
  aside,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
  icon?: Icon;
  tone?: string;
  aside?: ReactNode;
}) {
  return (
    <Plate className="flex min-h-[8.5rem] flex-col justify-between p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[0.66rem] font-medium uppercase tracking-[0.12em] text-muted">
          {label}
        </p>
        {aside ??
          (IconCmp && (
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white/[0.03]">
              <IconCmp className="size-[1.1rem] text-teal" />
            </span>
          ))}
      </div>
      <div>
        <p
          className={`font-display text-[2.1rem] font-semibold leading-none tabular-nums ${tone}`}
        >
          {value}
          {unit && (
            <span className="ml-1 font-sans text-base font-normal text-muted">
              {unit}
            </span>
          )}
        </p>
        {sub && <p className="mt-2 text-xs leading-snug text-muted">{sub}</p>}
      </div>
    </Plate>
  );
}

/** Circular progress (0–1). */
export function Ring({ value, label }: { value: number; label: string }) {
  const r = 17;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg
      viewBox="0 0 44 44"
      className="size-11 -rotate-90"
      role="img"
      aria-label={label}
    >
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="var(--line)"
        strokeWidth="4"
      />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="var(--teal)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${c * v} ${c}`}
      />
    </svg>
  );
}

export function SeverityChip({ d, score }: { d: D; score: number | null }) {
  if (score === null) return <span className="text-xs text-muted">—</span>;
  const lv = level(score);
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-sm font-medium tabular-nums text-ink">
        {score}
        <span className="text-muted">/25</span>
      </span>
      <span
        className={`rounded-md border px-1.5 py-0.5 text-[0.68rem] font-medium ${LEVEL_CHIP[lv]}`}
      >
        {d.levels[lv]}
      </span>
    </span>
  );
}

export type RadarAxis = {
  key: string;
  label: string;
  value: number;
  live: boolean;
};

/**
 * One axis per agent; the polygon joins each live agent's highest severity (out of 25).
 * Agents that are not live yet sit at the centre with a hollow marker.
 */
export function AgentRadar({
  axes,
  label,
}: {
  axes: RadarAxis[];
  label: string;
}) {
  const size = 240;
  const c = size / 2;
  const R = 92;
  const n = axes.length;
  const point = (i: number, ratio: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * R * ratio, c + Math.sin(a) * R * ratio] as const;
  };
  const ring = (ratio: number) =>
    axes.map((_, i) => point(i, ratio).join(",")).join(" ");
  const shape = axes
    .map((a, i) =>
      point(i, a.live ? Math.max(a.value / 25, 0.06) : 0.06).join(","),
    )
    .join(" ");
  return (
    <svg
      viewBox={`-34 -14 ${size + 68} ${size + 28}`}
      className="mx-auto w-full max-w-[19rem]"
      role="img"
      aria-label={label}
    >
      <defs>
        <radialGradient id="radar-fill" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--teal)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--electric)" stopOpacity="0.35" />
        </radialGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((r) => (
        <polygon
          key={r}
          points={ring(r)}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="1"
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, 1);
        return (
          <line
            key={i}
            x1={c}
            y1={c}
            x2={x}
            y2={y}
            stroke="rgba(255,255,255,0.05)"
          />
        );
      })}
      <polygon
        points={shape}
        fill="url(#radar-fill)"
        stroke="var(--teal)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {axes.map((a, i) => {
        const [x, y] = point(i, a.live ? Math.max(a.value / 25, 0.06) : 0.06);
        const [lx, ly] = point(i, 1.17);
        return (
          <g key={a.key}>
            <circle
              cx={x}
              cy={y}
              r={a.live ? 3.5 : 2.5}
              fill={a.live ? "var(--teal)" : "var(--abyss)"}
              stroke={a.live ? "none" : "var(--muted)"}
            />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted"
              style={{ fontSize: 10.5, opacity: a.live ? 1 : 0.55 }}
            >
              {a.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
