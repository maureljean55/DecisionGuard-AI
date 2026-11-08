import {
  AlarmClock,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  History,
  ListTodo,
  Radar,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { Suspense } from "react";

import {
  Eyebrow,
  KpiTile,
  PageHeader,
  Plate,
} from "@/components/dashboard/cockpit";
import { ActionStatusSelect } from "@/components/dashboard/followup";
import { LocalTime } from "@/components/dashboard/local-time";
import { PageSkeleton } from "@/components/dashboard/page-title";
import { IndexChip } from "@/components/dashboard/risk";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { apiGet } from "@/lib/api";
import { loadOrg } from "@/lib/dash-data";
import { fmt } from "@/lib/format";
import { canWriteDecisions } from "@/lib/permissions";
import type { Analysis, Decision, MitigationAction } from "@/lib/types";

const DAY = 86_400_000;
type Alert = {
  key: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
  decision: Decision;
  text: string;
};

async function Monitoring({
  params,
}: {
  params: Promise<{ lang: string; orgId: string }>;
}) {
  const { lang: raw, orgId } = await params;
  if (!hasLocale(raw)) notFound();
  const lang: Locale = raw;
  const [dict, org] = await Promise.all([
    getDictionary(lang),
    loadOrg(lang, orgId),
  ]);
  const d = dict.dash;
  const M = d.monitoring;
  const base = `/${lang}/app/${org.id}`;
  const [decisionsRes, analysesRes, actionsRes] = await Promise.all([
    apiGet<Decision[]>(`/orgs/${org.id}/decisions`),
    apiGet<Analysis[]>(`/orgs/${org.id}/analyses`),
    apiGet<MitigationAction[]>(`/orgs/${org.id}/actions`),
  ]);
  const watched = (decisionsRes.data ?? []).filter(
    (x) => x.status === "submitted",
  );
  const actions = actionsRes.data ?? [];
  const now = new Date().getTime(); // server render: one request, one instant
  const today = new Date().toISOString().slice(0, 10);

  // Completed analyses per decision, most recent first.
  const history = new Map<string, Analysis[]>();
  for (const a of analysesRes.data ?? []) {
    if (a.status !== "completed" || a.risk_score === null) continue;
    history.set(a.decision_id, [...(history.get(a.decision_id) ?? []), a]);
  }
  for (const list of history.values())
    list.sort((a, b) =>
      (b.finished_at ?? b.created_at).localeCompare(
        a.finished_at ?? a.created_at,
      ),
    );

  const alerts: Alert[] = [];
  const rows = watched.map((x) => {
    const [last, prev] = history.get(x.id) ?? [];
    const delta =
      last && prev
        ? (last.risk_score as number) - (prev.risk_score as number)
        : null;
    const lastAt = last
      ? new Date(last.finished_at ?? last.created_at).getTime()
      : null;
    const next =
      x.monitor_every_days && lastAt
        ? new Date(lastAt + x.monitor_every_days * DAY).toISOString()
        : null;
    if (last?.risk_level === "critical")
      alerts.push({
        key: `c-${x.id}`,
        icon: ShieldAlert,
        tone: "text-risk-critical",
        decision: x,
        text: fmt(M.alert.critical, { score: String(last.risk_score) }),
      });
    if (delta !== null && delta >= 5)
      alerts.push({
        key: `r-${x.id}`,
        icon: TrendingUp,
        tone: "text-risk-high",
        decision: x,
        text: fmt(M.alert.rising, { d: String(delta) }),
      });
    if (x.deadline) {
      const days = Math.round(
        (new Date(`${x.deadline}T00:00:00Z`).getTime() - now) / DAY,
      );
      if (days >= 0 && days <= 30)
        alerts.push({
          key: `d-${x.id}`,
          icon: CalendarClock,
          tone: "text-risk-moderate",
          decision: x,
          text: fmt(M.alert.deadline, { n: String(days) }),
        });
      else if (days < 0)
        alerts.push({
          key: `d-${x.id}`,
          icon: CalendarClock,
          tone: "text-risk-high",
          decision: x,
          text: fmt(M.alert.deadlinePast, { n: String(-days) }),
        });
    }
    if (lastAt && now - lastAt > 60 * DAY)
      alerts.push({
        key: `s-${x.id}`,
        icon: History,
        tone: "text-muted",
        decision: x,
        text: fmt(M.alert.stale, {
          n: String(Math.round((now - lastAt) / DAY)),
        }),
      });
    const mine = actions.filter((a) => a.decision_id === x.id);
    return { x, last, delta, next, mine };
  });
  const overdue = actions.filter(
    (a) => a.status !== "done" && a.due_date !== null && a.due_date < today,
  );
  for (const a of overdue) {
    const x = watched.find((w) => w.id === a.decision_id);
    if (x)
      alerts.push({
        key: `o-${a.id}`,
        icon: AlarmClock,
        tone: "text-risk-high",
        decision: x,
        text: fmt(M.alert.overdue, { title: a.title }),
      });
  }
  const doneCount = actions.filter((a) => a.status === "done").length;
  const canWrite = canWriteDecisions(org.role);

  return (
    <>
      <PageHeader eyebrow={M.eyebrow} title={M.title} subtitle={M.subtitle} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label={M.kpi.watched}
          value={watched.filter((x) => x.monitor_every_days).length}
          icon={Radar}
          sub={M.kpi.watchedSub}
        />
        <KpiTile
          label={M.kpi.alerts}
          value={alerts.length}
          tone={alerts.length ? "text-risk-high" : "text-ink"}
          icon={BellRing}
          sub={M.kpi.alertsSub}
        />
        <KpiTile
          label={M.kpi.overdue}
          value={overdue.length}
          tone={overdue.length ? "text-risk-critical" : "text-ink"}
          icon={AlarmClock}
          sub={M.kpi.overdueSub}
        />
        <KpiTile
          label={M.kpi.done}
          value={doneCount}
          tone="text-teal"
          icon={CheckCircle2}
          sub={fmt(M.kpi.doneSub, { n: String(actions.length) })}
        />
      </div>

      {/* Alerts */}
      <Plate className="mt-5 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
          <BellRing className="size-5 text-teal" aria-hidden />
          {M.alertsTitle}
        </h2>
        {alerts.length ? (
          <ul className="mt-4 divide-y divide-line">
            {alerts.map((a) => (
              <li key={a.key}>
                <Link
                  href={`${base}/decisions/${a.decision.id}`}
                  className="group flex items-start gap-3 py-3 first:pt-0"
                >
                  <a.icon className={`mt-0.5 size-4 shrink-0 ${a.tone}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink group-hover:text-teal">
                      {a.decision.title}
                    </span>
                    <span className="block text-xs text-muted">{a.text}</span>
                  </span>
                  <ArrowRight
                    className="mt-0.5 size-4 shrink-0 text-muted"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {M.alertsEmpty}
          </p>
        )}
      </Plate>

      {/* Watch list */}
      <Plate className="mt-5 p-5 sm:p-6">
        <Eyebrow>{M.eyebrow}</Eyebrow>
        <h2 className="mt-1.5 font-display text-xl font-semibold text-ink">
          {M.watchTitle}
        </h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{M.watchEmpty}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {rows.map(({ x, last, delta, next, mine }) => (
              <li
                key={x.id}
                className="grid gap-x-5 gap-y-2 py-4 first:pt-0 sm:grid-cols-[minmax(0,2fr)_9rem_8rem_minmax(0,1.2fr)_6rem]"
              >
                <div className="min-w-0">
                  <Link
                    href={`${base}/decisions/${x.id}`}
                    className="block truncate text-sm font-medium text-ink hover:text-teal"
                  >
                    {x.title}
                  </Link>
                  <span className="text-xs text-muted">
                    {d.decisions.categories[x.category]}
                  </span>
                </div>
                <div>
                  <span className="block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">
                    {M.col.index}
                  </span>
                  <IndexChip
                    d={d}
                    score={last?.risk_score}
                    levelKey={last?.risk_level}
                  />
                </div>
                <div>
                  <span className="block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">
                    {M.col.trend}
                  </span>
                  {delta === null ? (
                    <span className="text-xs text-muted">{M.never}</span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1 font-mono text-sm ${
                        delta > 0
                          ? "text-risk-high"
                          : delta < 0
                            ? "text-teal"
                            : "text-muted"
                      }`}
                    >
                      {delta > 0 ? (
                        <ArrowUpRight className="size-4" aria-hidden />
                      ) : delta < 0 ? (
                        <ArrowDownRight className="size-4" aria-hidden />
                      ) : null}
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  )}
                </div>
                <div className="text-xs">
                  <span className="block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">
                    {M.col.last} · {M.col.next}
                  </span>
                  <span className="text-ink/90">
                    {last ? (
                      <LocalTime
                        iso={last.finished_at ?? last.created_at}
                        lang={lang}
                      />
                    ) : (
                      M.never
                    )}
                  </span>
                  <span className="text-muted">
                    {" → "}
                    {x.monitor_every_days ? (
                      next ? (
                        <LocalTime iso={next} lang={lang} />
                      ) : (
                        M.never
                      )
                    ) : (
                      M.manual
                    )}
                  </span>
                </div>
                <div className="text-xs">
                  <span className="block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-muted">
                    {M.col.actions}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono text-ink">
                    <ListTodo className="size-3.5 text-muted" aria-hidden />
                    {mine.filter((a) => a.status === "done").length}/
                    {mine.length}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Plate>

      {/* Actions */}
      <Plate className="mt-5 p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold text-ink">
          {M.actionsTitle}
        </h2>
        {actions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{M.actionsEmpty}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {actions.map((a) => {
              const late =
                a.status !== "done" &&
                a.due_date !== null &&
                a.due_date < today;
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-3 py-3 first:pt-0"
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm ${a.status === "done" ? "text-muted line-through decoration-muted/50" : "text-ink"}`}
                    >
                      {a.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      <Link
                        href={`${base}/decisions/${a.decision_id}`}
                        className="hover:text-teal"
                      >
                        {a.decision_title}
                      </Link>
                      {" · "}
                      {a.owner_name ?? M.panel.noOwner}
                      {a.due_date && (
                        <span className={late ? "text-risk-critical" : ""}>
                          {" · "}
                          {M.panel.due}{" "}
                          <LocalTime
                            iso={`${a.due_date}T00:00:00Z`}
                            lang={lang}
                          />
                        </span>
                      )}
                    </p>
                  </div>
                  <ActionStatusSelect
                    d={d}
                    orgId={org.id}
                    action={a}
                    canWrite={canWrite}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Plate>
    </>
  );
}

export default function Page({
  params,
}: PageProps<"/[lang]/app/[orgId]/monitoring">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Monitoring params={params} />
    </Suspense>
  );
}
