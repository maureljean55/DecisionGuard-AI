/** Monitoring views built from stored data. Server-safe. */
import {
  AlarmClock,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  FilePlus2,
  ListPlus,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";

import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/lib/format";
import { level, LEVEL_FILL, LEVEL_TEXT, severity } from "@/lib/risk";
import type {
  Analysis,
  Decision,
  MitigationAction,
  OrgFinding,
} from "@/lib/types";

import { level25 } from "./charts";
import { Plate } from "./cockpit";
import { CreateActionButton } from "./followup";
import { LocalTime } from "./local-time";
import { IndexChip } from "./risk";

type D = Dictionary["dash"];
export const DAY = 86_400_000;
const LEVEL_HEX = {
  low: "#2f9e6e",
  moderate: "#d9a521",
  high: "#e07b2a",
  critical: "#d23c55",
} as const;

export function Sparkline({
  scores,
  label,
}: {
  scores: number[];
  label: string;
}) {
  if (scores.length === 0) return null;
  const W = 120;
  const H = 34;
  const x = (i: number) =>
    scores.length === 1 ? W / 2 : 4 + (i / (scores.length - 1)) * (W - 8);
  const y = (v: number) => 4 + (1 - v / 100) * (H - 8);
  const last = scores[scores.length - 1];
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-9 w-[7.5rem]"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <line x1="0" x2={W} y1={y(65)} y2={y(65)} stroke="rgba(210,60,85,0.25)" />
      {scores.length > 1 && (
        <polyline
          fill="none"
          stroke="#3478f6"
          strokeWidth="2"
          strokeLinejoin="round"
          points={scores.map((s, i) => `${x(i)},${y(s)}`).join(" ")}
        />
      )}
      <circle
        cx={x(scores.length - 1)}
        cy={y(last)}
        r="3.5"
        fill={LEVEL_HEX[level25(last)]}
        stroke="#0d1426"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function Countdown({
  icon: Icon,
  label,
  fraction,
  tone,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  fraction: number | null; // share of the period already elapsed, 0–1
  tone: string;
}) {
  return (
    <div>
      <p className={`flex items-center gap-1.5 text-xs ${tone}`}>
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      {fraction !== null && (
        <div className="mt-1.5 h-1 rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-electric to-teal"
            style={{ width: `${Math.min(Math.max(fraction, 0), 1) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function deadlineLabel(d: D, deadline: string | null, now: number) {
  const C = d.monitoring.cards;
  if (!deadline)
    return {
      text: C.noDeadline,
      tone: "text-muted",
      days: null as number | null,
    };
  const days = Math.round(
    (new Date(`${deadline}T00:00:00Z`).getTime() - now) / DAY,
  );
  if (days < 0)
    return {
      text: fmt(C.deadlinePast, { n: String(-days) }),
      tone: "text-risk-critical",
      days,
    };
  return {
    text: fmt(C.deadlineIn, { n: String(days) }),
    tone: days <= 30 ? "text-risk-moderate" : "text-muted",
    days,
  };
}

export function WatchCard({
  d,
  base,
  decision,
  history,
  actions,
  risks,
  now,
}: {
  d: D;
  base: string;
  decision: Decision;
  history: Analysis[]; // completed, most recent first
  actions: MitigationAction[];
  risks: { f: OrgFinding; covered: boolean }[];
  now: number;
}) {
  const C = d.monitoring.cards;
  const [last, prev] = history;
  const delta =
    last && prev
      ? (last.risk_score as number) - (prev.risk_score as number)
      : null;
  const lastAt = last
    ? new Date(last.finished_at ?? last.created_at).getTime()
    : null;
  const every = decision.monitor_every_days;
  const nextAt = every && lastAt ? lastAt + every * DAY : null;
  const nextDays = nextAt ? Math.ceil((nextAt - now) / DAY) : null;
  const dl = deadlineLabel(d, decision.deadline, now);
  const done = actions.filter((a) => a.status === "done").length;
  const doing = actions.filter((a) => a.status === "in_progress").length;
  const scores = [...history].reverse().map((a) => a.risk_score as number);

  return (
    <Plate className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`${base}/decisions/${decision.id}`}
            className="block font-display text-lg font-semibold leading-snug text-ink hover:text-teal"
          >
            {decision.title}
          </Link>
          <p className="text-xs text-muted">
            {d.decisions.categories[decision.category]}
          </p>
        </div>
        {last ? (
          <IndexChip d={d} score={last.risk_score} levelKey={last.risk_level} />
        ) : (
          <span className="text-xs text-muted">{C.notAnalysed}</span>
        )}
      </div>

      {last && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <Sparkline
            scores={scores}
            label={scores.map((s) => `${s}`).join(" → ")}
          />
          {delta !== null && (
            <span
              className={`font-mono text-sm ${delta > 0 ? "text-risk-high" : delta < 0 ? "text-teal" : "text-muted"}`}
            >
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Countdown
          icon={RefreshCw}
          label={
            nextDays === null
              ? C.nextOff
              : nextDays <= 0
                ? C.nextDue
                : fmt(C.nextIn, { n: String(nextDays) })
          }
          fraction={every && lastAt ? (now - lastAt) / (every * DAY) : null}
          tone={
            nextDays !== null && nextDays <= 0
              ? "text-risk-moderate"
              : "text-muted"
          }
        />
        <Countdown
          icon={CalendarClock}
          label={dl.text}
          fraction={null}
          tone={dl.tone}
        />
      </div>

      <div className="mt-4">
        <p className="flex justify-between text-xs text-muted">
          <span>
            {actions.length
              ? fmt(C.progress, {
                  done: String(done),
                  total: String(actions.length),
                })
              : C.noActions}
          </span>
        </p>
        {actions.length > 0 && (
          <div className="mt-1.5 flex h-1.5 gap-[2px] overflow-hidden rounded-full">
            <span
              className="bg-teal"
              style={{ width: `${(done / actions.length) * 100}%` }}
            />
            <span
              className="bg-electric"
              style={{ width: `${(doing / actions.length) * 100}%` }}
            />
            <span className="flex-1 bg-white/[0.08]" />
          </div>
        )}
      </div>

      {risks.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
            {C.topRisks}
          </p>
          <ul className="mt-2 space-y-2">
            {risks.map(({ f, covered }) => (
              <li key={f.id} className="flex items-start gap-2 text-xs">
                <span
                  className={`mt-1 size-1.5 shrink-0 rounded-full ${LEVEL_FILL[level(severity(f))]}`}
                />
                <span className="min-w-0 flex-1 text-ink/90">{f.title}</span>
                <span
                  className={`shrink-0 rounded-md border px-1.5 text-[0.64rem] ${
                    covered
                      ? "border-teal/40 text-teal"
                      : "border-risk-high/40 text-risk-high"
                  }`}
                >
                  {covered ? C.covered : C.uncovered}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Plate>
  );
}

export type AgendaItem = {
  key: string;
  kind: "deadline" | "action" | "reanalysis";
  date: string; // YYYY-MM-DD
  title: string;
  href: string;
};

const AGENDA_ICON = {
  deadline: CalendarClock,
  action: ListPlus,
  reanalysis: RefreshCw,
} as const;

export function Agenda({
  d,
  lang,
  items,
  now,
}: {
  d: D;
  lang: string;
  items: AgendaItem[];
  now: number;
}) {
  const A = d.monitoring.agenda;
  const days = (date: string) =>
    Math.round((new Date(`${date}T00:00:00Z`).getTime() - now) / DAY);
  const sorted = [...items]
    .filter((i) => days(i.date) <= 60)
    .sort((a, b) => a.date.localeCompare(b.date));
  const late = sorted.filter((i) => days(i.date) < 0);
  const upcoming = sorted.filter((i) => days(i.date) >= 0);
  const row = (i: AgendaItem) => {
    const n = days(i.date);
    const Icon = AGENDA_ICON[i.kind];
    return (
      <li key={i.key}>
        <Link href={i.href} className="group flex items-start gap-3 py-2.5">
          <span className="w-16 shrink-0 text-right font-mono text-[0.68rem] text-muted">
            <LocalTime iso={`${i.date}T00:00:00Z`} lang={lang} />
          </span>
          <Icon
            className={`mt-0.5 size-4 shrink-0 ${n < 0 ? "text-risk-critical" : "text-teal"}`}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-ink group-hover:text-teal">
              {i.title}
            </span>
            <span className="text-[0.7rem] text-muted">
              {A.kinds[i.kind]} ·{" "}
              {n === 0
                ? A.today
                : n > 0
                  ? fmt(A.inDays, { n: String(n) })
                  : fmt(A.daysAgo, { n: String(-n) })}
            </span>
          </span>
        </Link>
      </li>
    );
  };
  return (
    <Plate className="p-5 sm:p-6">
      <h2 className="font-display text-xl font-semibold text-ink">{A.title}</h2>
      <p className="mt-0.5 text-xs text-muted">{A.subtitle}</p>
      {sorted.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{A.empty}</p>
      ) : (
        <>
          {late.length > 0 && (
            <>
              <p className="mt-4 flex items-center gap-1.5 font-mono text-[0.64rem] uppercase tracking-[0.12em] text-risk-critical">
                <AlarmClock className="size-3.5" aria-hidden />
                {A.overdue}
              </p>
              <ul className="divide-y divide-line">{late.map(row)}</ul>
            </>
          )}
          <ul className="mt-2 divide-y divide-line">{upcoming.map(row)}</ul>
        </>
      )}
    </Plate>
  );
}

export function UncoveredRisks({
  d,
  base,
  orgId,
  items,
  canWrite,
}: {
  d: D;
  base: string;
  orgId: string;
  items: OrgFinding[];
  canWrite: boolean;
}) {
  const U = d.monitoring.uncovered;
  return (
    <Plate className="p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
        <ShieldAlert className="size-5 text-risk-critical" aria-hidden />
        {U.title}
        {items.length > 0 && (
          <span className="rounded-md bg-risk-critical/15 px-1.5 font-mono text-xs text-risk-critical">
            {items.length}
          </span>
        )}
      </h2>
      <p className="mt-0.5 text-xs text-muted">{U.subtitle}</p>
      {items.length === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-teal">
          <CheckCircle2 className="size-4" aria-hidden />
          {U.empty}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {items.slice(0, 8).map((f) => (
            <li key={f.id} className="py-3 first:pt-0">
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span
                    className={`block text-sm font-medium ${LEVEL_TEXT[level(severity(f))]}`}
                  >
                    {f.title}
                  </span>
                  <Link
                    href={`${base}/decisions/${f.decision_id}`}
                    className="text-xs text-muted hover:text-teal"
                  >
                    {d.agentCatalog[f.agent as keyof typeof d.agentCatalog]
                      ?.name ?? f.agent}{" "}
                    · {f.decision_title}
                  </Link>
                </span>
                <span className="shrink-0 font-mono text-xs text-ink">
                  {severity(f)}
                  <span className="text-muted">/25</span>
                </span>
              </div>
              {canWrite && (
                <div className="mt-2">
                  <CreateActionButton
                    d={d}
                    orgId={orgId}
                    decisionId={f.decision_id}
                    findingId={f.id}
                    title={f.mitigation}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {items.length > 8 && (
        <p className="mt-3 text-xs text-muted">
          {fmt(U.more, { n: String(items.length - 8) })}
        </p>
      )}
    </Plate>
  );
}

export type TimelineEvent = {
  key: string;
  at: string;
  kind: "submitted" | "analysis" | "created" | "done";
  text: string;
  score?: number;
};

const TL_ICON = {
  submitted: FilePlus2,
  analysis: CircleDot,
  created: ListPlus,
  done: CheckCircle2,
} as const;

export function Timeline({
  d,
  lang,
  events,
}: {
  d: D;
  lang: string;
  events: TimelineEvent[];
}) {
  const T = d.monitoring.timeline;
  if (events.length === 0)
    return <p className="text-sm text-muted">{T.empty}</p>;
  return (
    <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[0.8rem] before:top-2 before:w-px before:bg-line">
      {events.map((e) => {
        const Icon = TL_ICON[e.kind];
        const tone =
          e.kind === "analysis" && e.score !== undefined
            ? LEVEL_TEXT[level25(e.score)]
            : e.kind === "done"
              ? "text-teal"
              : "text-iris";
        return (
          <li key={e.key} className="relative flex gap-3">
            <span
              className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-abyss ${tone}`}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <span className="min-w-0 pt-0.5">
              <span className="block text-sm text-ink">{e.text}</span>
              <span className="text-[0.68rem] text-muted">
                <LocalTime iso={e.at} lang={lang} withTime />
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
