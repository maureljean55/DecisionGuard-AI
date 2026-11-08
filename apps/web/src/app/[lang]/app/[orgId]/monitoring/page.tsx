import {
  AlarmClock,
  ArrowRight,
  BellRing,
  CalendarClock,
  CheckCircle2,
  History,
  Radar,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ComponentType } from "react";

import { ActionBoard } from "@/components/dashboard/action-board";
import {
  ctaGhost,
  KpiTile,
  PageHeader,
  Plate,
  Ring,
} from "@/components/dashboard/cockpit";
import {
  Agenda,
  type AgendaItem,
  DAY,
  UncoveredRisks,
  WatchCard,
} from "@/components/dashboard/monitoring-views";
import { PageSkeleton } from "@/components/dashboard/page-title";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { apiGet } from "@/lib/api";
import { loadOrg } from "@/lib/dash-data";
import { fmt } from "@/lib/format";
import { canWriteDecisions } from "@/lib/permissions";
import { MAJOR, severity } from "@/lib/risk";
import type {
  ActionStatus,
  Analysis,
  Decision,
  Member,
  MitigationAction,
  OrgFinding,
} from "@/lib/types";

type Alert = {
  key: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
  decision: Decision;
  text: string;
};
const STATUSES: ActionStatus[] = ["todo", "in_progress", "done"];
const select =
  "h-10 min-w-0 rounded-xl border border-line bg-night/60 px-3 text-sm text-ink focus:border-electric/50 focus:outline-none";

async function Monitoring({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ lang: raw, orgId }, sp] = await Promise.all([params, searchParams]);
  if (!hasLocale(raw)) notFound();
  const lang: Locale = raw;
  const [dict, org] = await Promise.all([
    getDictionary(lang),
    loadOrg(lang, orgId),
  ]);
  const d = dict.dash;
  const M = d.monitoring;
  const base = `/${lang}/app/${org.id}`;
  const [decisionsRes, analysesRes, actionsRes, findingsRes, membersRes] =
    await Promise.all([
      apiGet<Decision[]>(`/orgs/${org.id}/decisions`),
      apiGet<Analysis[]>(`/orgs/${org.id}/analyses`),
      apiGet<MitigationAction[]>(`/orgs/${org.id}/actions`),
      apiGet<OrgFinding[]>(`/orgs/${org.id}/findings`),
      apiGet<Member[]>(`/orgs/${org.id}/members`),
    ]);
  const allWatched = (decisionsRes.data ?? []).filter(
    (x) => x.status === "submitted",
  );
  const allActions = actionsRes.data ?? [];
  const findings = findingsRes.data ?? [];
  const members = membersRes.data ?? [];
  const now = new Date().getTime(); // server render: one request, one instant
  const today = new Date(now).toISOString().slice(0, 10);
  const canWrite = canWriteDecisions(org.role);

  // --- Filters (one row, scoping everything below)
  const one = (k: string) =>
    typeof sp[k] === "string" ? (sp[k] as string) : "";
  const fDossier = one("dossier");
  const fOwner = one("owner");
  const fStatus = STATUSES.includes(one("status") as ActionStatus)
    ? (one("status") as ActionStatus)
    : "";
  const watched = fDossier
    ? allWatched.filter((x) => x.id === fDossier)
    : allWatched;
  const actions = allActions.filter(
    (a) =>
      (!fDossier || a.decision_id === fDossier) &&
      (!fOwner || a.owner_user_id === fOwner) &&
      (!fStatus || a.status === fStatus),
  );

  // --- History per decision
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
  const coveredFindings = new Set(
    allActions.map((a) => a.finding_id).filter(Boolean),
  );
  const uncovered = findings.filter(
    (f) =>
      severity(f) >= MAJOR &&
      f.audit_status !== "unsupported" &&
      !coveredFindings.has(f.id) &&
      (!fDossier || f.decision_id === fDossier),
  );

  // --- Alerts and agenda
  const alerts: Alert[] = [];
  const agenda: AgendaItem[] = [];
  for (const x of watched) {
    const [last, prev] = history.get(x.id) ?? [];
    const delta =
      last && prev
        ? (last.risk_score as number) - (prev.risk_score as number)
        : null;
    const lastAt = last
      ? new Date(last.finished_at ?? last.created_at).getTime()
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
      agenda.push({
        key: `dl-${x.id}`,
        kind: "deadline",
        date: x.deadline,
        title: x.title,
        href: `${base}/decisions/${x.id}`,
      });
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
    if (lastAt && x.monitor_every_days)
      agenda.push({
        key: `re-${x.id}`,
        kind: "reanalysis",
        date: new Date(lastAt + x.monitor_every_days * DAY)
          .toISOString()
          .slice(0, 10),
        title: x.title,
        href: `${base}/decisions/${x.id}`,
      });
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
  }
  for (const a of actions) {
    if (a.status === "done" || !a.due_date) continue;
    agenda.push({
      key: `ac-${a.id}`,
      kind: "action",
      date: a.due_date,
      title: a.title,
      href: `${base}/decisions/${a.decision_id}`,
    });
    const x = allWatched.find((w) => w.id === a.decision_id);
    if (a.due_date < today && x)
      alerts.push({
        key: `o-${a.id}`,
        icon: AlarmClock,
        tone: "text-risk-high",
        decision: x,
        text: fmt(M.alert.overdue, { title: a.title }),
      });
  }
  const overdue = actions.filter(
    (a) => a.status !== "done" && a.due_date !== null && a.due_date < today,
  ).length;
  const doneCount = actions.filter((a) => a.status === "done").length;

  return (
    <>
      <PageHeader eyebrow={M.eyebrow} title={M.title} subtitle={M.subtitle} />

      {/* Filters: one row above everything they scope */}
      <Plate className="mb-5 p-3">
        <form
          action={`${base}/monitoring`}
          className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
        >
          <label className="sr-only" htmlFor="f-dossier">
            {M.filters.dossier}
          </label>
          <select
            id="f-dossier"
            name="dossier"
            defaultValue={fDossier}
            className={`${select} sm:max-w-[16rem]`}
          >
            <option value="">
              {M.filters.dossier} — {M.filters.all}
            </option>
            {allWatched.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="f-owner">
            {M.filters.owner}
          </label>
          <select
            id="f-owner"
            name="owner"
            defaultValue={fOwner}
            className={select}
          >
            <option value="">
              {M.filters.owner} — {M.filters.all}
            </option>
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.full_name}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="f-status">
            {M.filters.status}
          </label>
          <select
            id="f-status"
            name="status"
            defaultValue={fStatus}
            className={select}
          >
            <option value="">
              {M.filters.status} — {M.filters.all}
            </option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {M.status[s]}
              </option>
            ))}
          </select>
          <div className="flex gap-2 sm:ml-auto">
            <button type="submit" className={ctaGhost}>
              {M.filters.apply}
            </button>
            {(fDossier || fOwner || fStatus) && (
              <Link href={`${base}/monitoring`} className={ctaGhost}>
                {M.filters.reset}
              </Link>
            )}
          </div>
        </form>
      </Plate>

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
          value={overdue}
          tone={overdue ? "text-risk-critical" : "text-ink"}
          icon={AlarmClock}
          sub={M.kpi.overdueSub}
        />
        <KpiTile
          label={M.kpi.done}
          value={doneCount}
          tone="text-teal"
          sub={fmt(M.kpi.doneSub, { n: String(actions.length) })}
          aside={
            actions.length ? (
              <Ring
                value={doneCount / actions.length}
                label={`${doneCount}/${actions.length}`}
              />
            ) : (
              <span className="flex size-10 items-center justify-center rounded-xl border border-line bg-white/[0.03]">
                <CheckCircle2 className="size-[1.1rem] text-teal" />
              </span>
            )
          }
        />
      </div>

      {/* Alerts + uncovered risks */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2 xl:items-start">
        <Plate className="p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
            <BellRing className="size-5 text-teal" aria-hidden />
            {M.alertsTitle}
            {alerts.length > 0 && (
              <span className="rounded-md bg-risk-high/15 px-1.5 font-mono text-xs text-risk-high">
                {alerts.length}
              </span>
            )}
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
        <UncoveredRisks
          d={d}
          base={base}
          orgId={org.id}
          items={uncovered}
          canWrite={canWrite}
        />
      </div>

      {/* Watch cards + agenda */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold text-ink">
            {M.watchTitle}
          </h2>
          {watched.length === 0 ? (
            <Plate className="p-5 text-sm text-muted">{M.watchEmpty}</Plate>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {watched.map((x) => {
                const top = findings
                  .filter((f) => f.decision_id === x.id)
                  .slice(0, 2)
                  .map((f) => ({ f, covered: coveredFindings.has(f.id) }));
                return (
                  <WatchCard
                    key={x.id}
                    d={d}
                    base={base}
                    decision={x}
                    history={history.get(x.id) ?? []}
                    actions={allActions.filter((a) => a.decision_id === x.id)}
                    risks={top}
                    now={now}
                  />
                );
              })}
            </div>
          )}
        </section>
        <Agenda d={d} lang={lang} items={agenda} now={now} />
      </div>

      {/* Action board */}
      <section className="mt-6">
        <h2 className="mb-3 font-display text-xl font-semibold text-ink">
          {M.board.title}
        </h2>
        {allActions.length === 0 ? (
          <Plate className="p-5 text-sm text-muted">{M.actionsEmpty}</Plate>
        ) : (
          <ActionBoard
            d={d}
            lang={lang}
            orgId={org.id}
            actions={actions}
            members={members}
            canWrite={canWrite}
            base={base}
            today={today}
          />
        )}
      </section>
    </>
  );
}

export default function Page({
  params,
  searchParams,
}: PageProps<"/[lang]/app/[orgId]/monitoring">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Monitoring params={params} searchParams={searchParams} />
    </Suspense>
  );
}
