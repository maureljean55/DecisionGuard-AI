import { ArrowLeft, CalendarClock, PencilLine, RefreshCw } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { AgentResults } from "@/components/dashboard/agent-results";
import { AnalysisPanel } from "@/components/dashboard/analysis";
import {
  DomainBars,
  ScoreBreakdown,
  ScoreHistory,
  Tornado,
} from "@/components/dashboard/charts";
import { ActionBoard } from "@/components/dashboard/action-board";
import { Plate, Ring } from "@/components/dashboard/cockpit";
import {
  AddActionForm,
  MonitoringSelect,
} from "@/components/dashboard/followup";
import {
  Countdown,
  DAY,
  deadlineLabel,
  Sparkline,
  Timeline,
  type TimelineEvent,
} from "@/components/dashboard/monitoring-views";
import { RiskPanel } from "@/components/dashboard/risk";
import { DecisionActions } from "@/components/dashboard/decisions";
import { LocalTime } from "@/components/dashboard/local-time";
import { PageSkeleton } from "@/components/dashboard/page-title";
import { formatAmount, StatusBadge } from "@/components/dashboard/status";
import { Panel } from "@/components/dashboard/ui";
import { hasLocale, type Locale } from "@/i18n/config";
import { type Dictionary, getDictionary } from "@/i18n/dictionaries";
import { apiGet, getMe } from "@/lib/api";
import { loadOrg } from "@/lib/dash-data";
import { fmt } from "@/lib/format";
import { canDeleteDecision, canWriteDecisions } from "@/lib/permissions";
import type { Analysis, Decision, Member, MitigationAction } from "@/lib/types";

async function DecisionPage({
  params,
}: {
  params: Promise<{ lang: string; orgId: string; decisionId: string }>;
}) {
  const { lang: raw, orgId, decisionId } = await params;
  if (!hasLocale(raw)) notFound();
  const lang: Locale = raw;
  const [me, dict, org] = await Promise.all([
    getMe(),
    getDictionary(lang),
    loadOrg(lang, orgId),
  ]);
  if (!me) redirect(`/${lang}/login`);
  const res = await apiGet<Decision>(
    `/orgs/${org.id}/decisions/${encodeURIComponent(decisionId)}`,
  );
  if (!res.data) notFound();
  const x = res.data;
  const history =
    (await apiGet<Analysis[]>(`/orgs/${org.id}/decisions/${x.id}/analyses`))
      .data ?? [];
  const analysis = history[0] ?? null;
  const [actionsRes, membersRes] = await Promise.all([
    apiGet<MitigationAction[]>(`/orgs/${org.id}/actions?decision_id=${x.id}`),
    apiGet<Member[]>(`/orgs/${org.id}/members`),
  ]);
  const actions = actionsRes.data ?? [];
  const members = membersRes.data ?? [];
  const followUp = buildFollowUp(dict.dash, x, history, actions, analysis);
  const sensitivity =
    analysis?.status === "completed" && analysis.risk_score !== null
      ? ((
          await apiGet<
            { agent: string; down: number; up: number; base: number }[]
          >(`/orgs/${org.id}/analyses/${analysis.id}/sensitivity`)
        ).data ?? [])
      : [];
  const d = dict.dash;
  const T = d.decisions.detail;
  const amount = formatAmount(x.amount, x.currency, lang);

  return (
    <>
      <Link
        href={`/${lang}/app/${org.id}/decisions`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {T.back}
      </Link>
      <div className="mb-8 mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[2rem] font-medium leading-tight text-ink sm:text-[2.4rem]">
              {x.title}
            </h1>
            <StatusBadge status={x.status} d={d} analysis={x.latest_analysis} />
          </div>
          <p className="mt-2 text-sm text-muted">
            {x.created_by_name
              ? `${fmt(T.by, { name: x.created_by_name })} · `
              : ""}
            {T.updated} <LocalTime iso={x.updated_at} lang={lang} withTime />
          </p>
        </div>
        <DecisionActions
          d={d}
          lang={lang}
          orgId={org.id}
          decision={x}
          canWrite={canWriteDecisions(org.role)}
          canDelete={canDeleteDecision(
            org.role,
            x.created_by_user_id,
            me.user.id,
          )}
        />
      </div>
      {analysis && analysis.status !== "canceled" && (
        <div className="mb-6">
          <AnalysisPanel
            d={d}
            orgId={org.id}
            analysis={analysis}
            canWrite={canWriteDecisions(org.role)}
          />
        </div>
      )}
      {analysis && analysis.status === "completed" && (
        <div className="mb-6">
          <RiskPanel d={d} lang={lang} orgId={org.id} analysis={analysis} />
        </div>
      )}
      {analysis &&
        analysis.status === "completed" &&
        analysis.risk_score !== null &&
        analysis.risk_breakdown && (
          <div className="mb-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <ScoreBreakdown
              d={d}
              lang={lang}
              score={analysis.risk_score}
              breakdown={analysis.risk_breakdown}
            />
            <DomainBars
              d={d}
              rows={analysis.agents
                .filter((r) => r.agent !== "audit" && r.status === "completed")
                .map((r) => ({
                  agent: r.agent,
                  count: r.findings.length,
                  max: r.findings
                    .filter((f) => f.audit_status !== "unsupported")
                    .reduce((m, f) => Math.max(m, f.likelihood * f.impact), 0),
                }))}
            />
            <Tornado d={d} rows={sensitivity} />
            <ScoreHistory
              d={d}
              lang={lang}
              points={history
                .filter(
                  (a) => a.status === "completed" && a.risk_score !== null,
                )
                .map((a) => ({
                  at: a.finished_at ?? a.created_at,
                  score: a.risk_score as number,
                }))
                .reverse()}
            />
          </div>
        )}
      {x.status === "submitted" && (
        <Plate className="mb-6 p-5 sm:p-6">
          <h2 className="font-display text-xl font-semibold text-ink">
            {d.monitoring.panel.title}
          </h2>
          <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="space-y-5">
              <MonitoringSelect
                d={d}
                orgId={org.id}
                decisionId={x.id}
                value={x.monitor_every_days}
                canWrite={canWriteDecisions(org.role)}
              />
              <div className="space-y-3 rounded-xl border border-line bg-night/40 p-4">
                <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                  {d.monitoring.countdown}
                </p>
                <Countdown
                  icon={RefreshCw}
                  label={followUp.nextLabel}
                  fraction={followUp.nextFraction}
                  tone={followUp.nextTone}
                />
                <Countdown
                  icon={CalendarClock}
                  label={followUp.deadline.text}
                  fraction={null}
                  tone={followUp.deadline.tone}
                />
              </div>
            </div>
            <div className="flex flex-col items-start gap-4 rounded-xl border border-line bg-night/40 p-4">
              <div className="flex items-center gap-3">
                <Ring
                  value={
                    followUp.majors ? followUp.covered / followUp.majors : 1
                  }
                  label={`${followUp.covered}/${followUp.majors}`}
                />
                <p className="text-sm text-ink">
                  {fmt(d.monitoring.coverage, {
                    c: String(followUp.covered),
                    t: String(followUp.majors),
                  })}
                </p>
              </div>
              <div className="w-full">
                <p className="text-xs text-muted">
                  {actions.length
                    ? fmt(d.monitoring.cards.progress, {
                        done: String(followUp.done),
                        total: String(actions.length),
                      })
                    : d.monitoring.cards.noActions}
                </p>
                {actions.length > 0 && (
                  <div className="mt-1.5 flex h-1.5 gap-[2px] overflow-hidden rounded-full">
                    <span
                      className="bg-teal"
                      style={{
                        width: `${(followUp.done / actions.length) * 100}%`,
                      }}
                    />
                    <span
                      className="bg-electric"
                      style={{
                        width: `${(followUp.doing / actions.length) * 100}%`,
                      }}
                    />
                    <span className="flex-1 bg-white/[0.08]" />
                  </div>
                )}
              </div>
              {history.filter((h) => h.risk_score !== null).length > 1 && (
                <Sparkline
                  scores={history
                    .filter(
                      (h) => h.status === "completed" && h.risk_score !== null,
                    )
                    .map((h) => h.risk_score as number)
                    .reverse()}
                  label={d.charts.history.title}
                />
              )}
            </div>
            <div>
              <p className="mb-3 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                {d.monitoring.timeline.title}
              </p>
              <div className="max-h-72 overflow-y-auto pr-1">
                <Timeline d={d} lang={lang} events={followUp.events} />
              </div>
            </div>
          </div>
          <div className="mt-6 border-t border-line pt-5">
            <p className="mb-3 text-sm font-medium text-ink">
              {d.monitoring.board.title}
            </p>
            <ActionBoard
              d={d}
              lang={lang}
              orgId={org.id}
              actions={actions}
              members={members}
              canWrite={canWriteDecisions(org.role)}
              today={followUp.today}
            />
            {canWriteDecisions(org.role) && (
              <div className="mt-5">
                <AddActionForm
                  d={d}
                  orgId={org.id}
                  decisionId={x.id}
                  members={members}
                  risks={followUp.risks}
                />
              </div>
            )}
          </div>
        </Plate>
      )}
      {analysis && (
        <div className="mb-8">
          <AgentResults
            d={d}
            analysis={analysis}
            target={
              canWriteDecisions(org.role)
                ? { orgId: org.id, decisionId: x.id }
                : null
            }
          />
        </div>
      )}
      {x.status === "draft" && (
        <div className="mb-6 flex gap-3 rounded-2xl border border-line bg-abyss/60 px-5 py-4 text-sm text-muted">
          <PencilLine className="mt-0.5 size-4 shrink-0" aria-hidden />
          {T.draftNote}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title={T.description}>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">
              {x.description}
            </p>
          </Panel>
          <Panel title={T.context}>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">
              {x.context ?? <span className="text-muted">{T.none}</span>}
            </p>
          </Panel>
        </div>
        <Panel>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs text-muted">{T.category}</dt>
              <dd className="mt-1 text-ink">
                {d.decisions.categories[x.category]}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{T.amount}</dt>
              <dd className="mt-1 font-mono text-ink">
                {amount ?? (
                  <span className="font-sans text-muted">{T.none}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{T.deadline}</dt>
              <dd className="mt-1 text-ink">
                {x.deadline ? (
                  <LocalTime iso={`${x.deadline}T12:00:00Z`} lang={lang} />
                ) : (
                  <span className="text-muted">{T.none}</span>
                )}
              </dd>
            </div>
            {x.submitted_at && (
              <div>
                <dt className="text-xs text-muted">{T.submittedOn}</dt>
                <dd className="mt-1 text-ink">
                  <LocalTime iso={x.submitted_at} lang={lang} withTime />
                </dd>
              </div>
            )}
          </dl>
        </Panel>
      </div>
    </>
  );
}

/** Figures and events of the follow-up panel, all from stored data. */
function buildFollowUp(
  d: Dictionary["dash"],
  x: Decision,
  history: Analysis[],
  actions: MitigationAction[],
  analysis: Analysis | null,
) {
  const C = d.monitoring.cards;
  const T = d.monitoring.timeline;
  const now = new Date().getTime(); // server render: one request, one instant
  const completed = history.filter(
    (h) => h.status === "completed" && h.risk_score !== null,
  );
  const last = completed[0];
  const lastAt = last
    ? new Date(last.finished_at ?? last.created_at).getTime()
    : null;
  const every = x.monitor_every_days;
  const nextDays =
    every && lastAt ? Math.ceil((lastAt + every * DAY - now) / DAY) : null;
  const findings =
    analysis?.agents.flatMap((r) =>
      r.findings.map((f) => ({ ...f, agent: r.agent })),
    ) ?? [];
  const majors = findings.filter(
    (f) => f.likelihood * f.impact >= 15 && f.audit_status !== "unsupported",
  );
  const linked = new Set(actions.map((a) => a.finding_id));
  const events: TimelineEvent[] = [];
  if (x.submitted_at)
    events.push({
      key: "s",
      at: x.submitted_at,
      kind: "submitted",
      text: T.submitted,
    });
  for (const h of completed)
    events.push({
      key: `a-${h.id}`,
      at: h.finished_at ?? h.created_at,
      kind: "analysis",
      score: h.risk_score as number,
      text: fmt(T.analysis, { score: String(h.risk_score) }),
    });
  for (const a of actions) {
    events.push({
      key: `c-${a.id}`,
      at: a.created_at,
      kind: "created",
      text: fmt(T.created, { title: a.title }),
    });
    if (a.done_at)
      events.push({
        key: `d-${a.id}`,
        at: a.done_at,
        kind: "done",
        text: fmt(T.done, { title: a.title }),
      });
  }
  events.sort((a, b) => b.at.localeCompare(a.at));
  return {
    today: new Date(now).toISOString().slice(0, 10),
    nextLabel:
      nextDays === null
        ? C.nextOff
        : nextDays <= 0
          ? C.nextDue
          : fmt(C.nextIn, { n: String(nextDays) }),
    nextFraction: every && lastAt ? (now - lastAt) / (every * DAY) : null,
    nextTone:
      nextDays !== null && nextDays <= 0 ? "text-risk-moderate" : "text-muted",
    deadline: deadlineLabel(d, x.deadline, now),
    majors: majors.length,
    covered: majors.filter((f) => linked.has(f.id)).length,
    done: actions.filter((a) => a.status === "done").length,
    doing: actions.filter((a) => a.status === "in_progress").length,
    events,
    risks: [...findings]
      .filter((f) => f.audit_status !== "unsupported")
      .sort((a, b) => b.likelihood * b.impact - a.likelihood * a.impact)
      .map((f) => ({
        id: f.id,
        title: f.title,
        severity: f.likelihood * f.impact,
        mitigation: f.mitigation,
      })),
  };
}

export default function Page({
  params,
}: PageProps<"/[lang]/app/[orgId]/decisions/[decisionId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DecisionPage params={params} />
    </Suspense>
  );
}
