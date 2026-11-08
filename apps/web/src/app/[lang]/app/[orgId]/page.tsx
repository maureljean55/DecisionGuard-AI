import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Bot,
  CheckCircle2,
  Circle,
  FolderKanban,
  Mail,
  Plus,
  ShieldAlert,
  Siren,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { ResendVerification } from "@/components/app/session-actions";
import {
  AgentRadar,
  ctaPrimary,
  Eyebrow,
  KpiTile,
  Plate,
  Ring,
  SeverityChip,
} from "@/components/dashboard/cockpit";
import { LocalTime } from "@/components/dashboard/local-time";
import { PageSkeleton } from "@/components/dashboard/page-title";
import { formatAmount, StatusBadge } from "@/components/dashboard/status";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { AGENT_CATALOG } from "@/lib/agents";
import { apiGet, getMe } from "@/lib/api";
import { loadOrg } from "@/lib/dash-data";
import { describeAction } from "@/lib/dash-format";
import { fmt } from "@/lib/format";
import { canReadAudit, canWriteDecisions } from "@/lib/permissions";
import { ALERT, level, LEVEL_TEXT, MAJOR, severity } from "@/lib/risk";
import type {
  AuditPage,
  Decision,
  EngineStatus,
  OrgFinding,
  Usage,
} from "@/lib/types";

type FeedItem =
  | { kind: "alert"; at: string; f: OrgFinding }
  | { kind: "event"; at: string; e: AuditPage["items"][number] };

async function Overview({
  params,
}: {
  params: Promise<{ lang: string; orgId: string }>;
}) {
  const { lang: raw, orgId } = await params;
  if (!hasLocale(raw)) notFound();
  const lang: Locale = raw;
  const [me, dict, org] = await Promise.all([
    getMe(),
    getDictionary(lang),
    loadOrg(lang, orgId),
  ]);
  if (!me) redirect(`/${lang}/login`);
  const d = dict.dash;
  const C = d.cockpit;
  const base = `/${lang}/app/${org.id}`;
  const [audit, decisionsRes, usageRes, findingsRes, engineRes] =
    await Promise.all([
      canReadAudit(org.role)
        ? apiGet<AuditPage>(`/orgs/${org.id}/audit-logs?limit=6`)
        : Promise.resolve({ status: 200, data: null }),
      apiGet<Decision[]>(`/orgs/${org.id}/decisions`),
      apiGet<Usage>(`/orgs/${org.id}/usage`),
      apiGet<OrgFinding[]>(`/orgs/${org.id}/findings`),
      apiGet<EngineStatus>("/engine"),
    ]);
  const decisions = decisionsRes.data ?? [];
  const findings = findingsRes.data ?? [];
  const usage = usageRes.data;
  const engine = engineRes.data;
  const canWrite = canWriteDecisions(org.role);

  // --- Figures, all derived from stored data.
  const active = decisions.filter((x) => x.status !== "archived");
  const running = active.filter((x) =>
    ["pending", "analyzing", "simulating", "verifying", "reporting"].includes(
      x.latest_analysis?.status ?? "",
    ),
  ).length;
  const awaiting = active.filter(
    (x) => x.latest_analysis?.status === "collecting_info",
  ).length;
  const major = findings.filter((f) => severity(f) >= MAJOR).length;
  const facts = findings.filter((f) => f.evidence_type === "fact").length;
  const factShare = findings.length
    ? Math.round((facts / findings.length) * 100)
    : null;

  const byDecision = new Map<string, { max: number; agents: Set<string> }>();
  for (const f of findings) {
    const row = byDecision.get(f.decision_id) ?? { max: 0, agents: new Set() };
    row.max = Math.max(row.max, severity(f));
    row.agents.add(f.agent);
    byDecision.set(f.decision_id, row);
  }
  const liveAgents = new Set(engine?.agents_active ?? []);
  const perAgent = AGENT_CATALOG.map((a) => {
    const mine = findings.filter((f) => f.agent === a.key);
    return {
      ...a,
      name: d.agentCatalog[a.key].name,
      live: liveAgents.has(a.key) || mine.length > 0,
      count: mine.length,
      max: mine.reduce((m, f) => Math.max(m, severity(f)), 0),
    };
  });
  const focus = findings[0] ?? null; // the API sorts by severity, then recency

  const feed: FeedItem[] = [
    ...findings
      .filter((f) => severity(f) >= ALERT)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5)
      .map((f) => ({ kind: "alert" as const, at: f.created_at, f })),
    ...(audit.data?.items ?? []).map((e) => ({
      kind: "event" as const,
      at: e.created_at,
      e,
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 7);

  const status = engine?.status ?? "unavailable";
  const firstSteps = [
    { label: d.overview.steps.verify, done: me.user.email_verified },
    { label: d.overview.steps.invite, href: `${base}/team`, done: false },
    {
      label: d.overview.steps.decision,
      href: `${base}/decisions/new`,
      done: decisions.some((x) => x.status === "submitted"),
    },
  ];

  return (
    <>
      {!me.user.email_verified && (
        <div
          role="status"
          className="mb-5 flex flex-col gap-3 rounded-2xl border border-risk-moderate/40 bg-risk-moderate/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-2 text-sm text-ink">
            <Mail className="size-4 shrink-0 text-risk-moderate" aria-hidden />
            {d.verify.text}
          </span>
          <span className="text-risk-moderate">
            <ResendVerification
              label={d.verify.resend}
              doneLabel={d.verify.sent}
            />
          </span>
        </div>
      )}

      {/* Engine banner */}
      <Plate className="relative mb-5 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_0%_0%,rgba(52,120,246,0.18),transparent_60%),radial-gradient(50%_120%_at_100%_100%,rgba(53,208,214,0.10),transparent_60%)]"
        />
        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-teal/30 bg-teal/10">
              <Bot className="size-5 text-teal" aria-hidden />
            </span>
            <div className="min-w-0">
              <Eyebrow live={status === "active"}>{C.eyebrow}</Eyebrow>
              <h1 className="mt-1.5 font-display text-2xl font-semibold leading-tight text-ink sm:text-[1.7rem]">
                {fmt(d.overview.hello, {
                  name: me.user.full_name.split(" ")[0],
                })}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
                <span className="font-medium text-ink">
                  {C.engineTitle[status]}.
                </span>{" "}
                {fmt(C.engineBody[status], {
                  n: String(engine?.agents_active.length ?? 0),
                  total: String(AGENT_CATALOG.length),
                })}
              </p>
            </div>
          </div>
          {canWrite && (
            <Link href={`${base}/decisions/new`} className={ctaPrimary}>
              <Plus className="size-4" aria-hidden />
              {C.newDecision}
            </Link>
          )}
        </div>
      </Plate>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label={C.majorRisks}
          value={major}
          tone={major ? "text-risk-critical" : "text-ink"}
          icon={ShieldAlert}
          sub={fmt(C.majorRisksSub, { n: String(findings.length) })}
        />
        <KpiTile
          label={C.activeDossiers}
          value={active.length}
          icon={FolderKanban}
          sub={fmt(C.activeSub, { a: String(running), q: String(awaiting) })}
        />
        <KpiTile
          label={C.usage}
          value={usage ? usage.used : "—"}
          unit={
            usage
              ? `/ ${usage.limit === null ? C.unlimited : usage.limit}`
              : undefined
          }
          sub={fmt(C.usageSub, {
            plan: (d.plans as Record<string, string>)[org.plan] ?? org.plan,
          })}
          aside={
            usage && usage.limit ? (
              <Ring
                value={usage.used / usage.limit}
                label={`${usage.used}/${usage.limit}`}
              />
            ) : (
              <span className="flex size-10 items-center justify-center rounded-xl border border-line bg-white/[0.03]">
                <Sparkles className="size-[1.1rem] text-teal" />
              </span>
            )
          }
        />
        <KpiTile
          label={C.facts}
          value={factShare === null ? "—" : factShare}
          unit={factShare === null ? undefined : "%"}
          tone="text-teal"
          icon={BadgeCheck}
          sub={C.factsSub}
        />
      </div>

      {/* Council + focus */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <Plate className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Eyebrow>{C.councilEyebrow}</Eyebrow>
              <h2 className="mt-1.5 font-display text-xl font-semibold text-ink">
                {C.councilTitle}
              </h2>
            </div>
            <Link
              href={`${base}/council`}
              className="inline-flex items-center gap-1 text-sm text-teal hover:text-ink"
            >
              {d.nav.council}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          <div className="mt-5 grid items-center gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            <div>
              <AgentRadar
                label={C.radarNote}
                axes={perAgent.map((a) => ({
                  key: a.key,
                  label: a.name,
                  value: a.max,
                  live: a.live,
                }))}
              />
              <p className="mt-2 text-center text-[0.7rem] text-muted">
                {C.radarNote}
              </p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {perAgent.map((a) => (
                <li
                  key={a.key}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    a.live
                      ? "border-line bg-white/[0.03]"
                      : "border-dashed border-line/80 opacity-60"
                  }`}
                >
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${
                      a.live
                        ? a.max
                          ? (
                              {
                                low: "bg-risk-low",
                                moderate: "bg-risk-moderate",
                                high: "bg-risk-high",
                                critical: "bg-risk-critical",
                              } as const
                            )[level(a.max)]
                          : "bg-teal"
                        : "bg-muted/50"
                    }`}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      {a.name}
                    </span>
                    <span className="block truncate text-[0.72rem] text-muted">
                      {!a.live
                        ? fmt(C.planned, { m: a.milestone })
                        : a.count
                          ? fmt(C.agentFindings, {
                              n: String(a.count),
                              s: String(a.max),
                            })
                          : C.agentNone}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Plate>

        <Plate className="flex flex-col p-5 sm:p-6">
          <Eyebrow>{C.focusEyebrow}</Eyebrow>
          {focus ? (
            <>
              <p className="mt-3 text-xs text-muted">{focus.decision_title}</p>
              <h2 className="mt-1 font-display text-xl font-semibold leading-snug text-ink">
                {focus.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-ink/85">
                {focus.description}
              </p>
              <div className="mt-4 rounded-xl border border-line bg-night/60 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted">
                    {fmt(C.byAgent, {
                      agent:
                        d.agentCatalog[
                          focus.agent as keyof typeof d.agentCatalog
                        ]?.name ?? focus.agent,
                    })}
                  </span>
                  <SeverityChip d={d} score={severity(focus)} />
                </div>
                <p className="mt-2.5 text-xs leading-relaxed text-muted">
                  <span className="text-ink/80">{d.results.mitigation} · </span>
                  {focus.mitigation}
                </p>
                {focus.simulated && (
                  <p className="mt-2 text-[0.7rem] text-risk-moderate">
                    {C.simulated}
                  </p>
                )}
              </div>
              <Link
                href={`${base}/decisions/${focus.decision_id}`}
                className="mt-auto inline-flex items-center justify-between gap-2 rounded-xl border border-line bg-white/[0.03] px-4 py-3 pt-3 text-sm text-ink transition-colors hover:bg-white/[0.07] [margin-top:1.25rem]"
              >
                {C.focusOpen}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </>
          ) : (
            <div className="mt-4 flex flex-1 flex-col">
              <p className="text-sm leading-relaxed text-muted">
                {C.focusEmpty}
              </p>
              <ul className="mt-5 space-y-2.5">
                {firstSteps.map((s) => {
                  const Icon = s.done ? CheckCircle2 : Circle;
                  const body = (
                    <span className="flex items-center gap-2.5 text-sm">
                      <Icon
                        className={`size-4 shrink-0 ${s.done ? "text-teal" : "text-muted/60"}`}
                        aria-hidden
                      />
                      <span
                        className={
                          s.done ? "text-muted line-through" : "text-ink"
                        }
                      >
                        {s.label}
                      </span>
                    </span>
                  );
                  return (
                    <li key={s.label}>
                      {s.href && !s.done ? (
                        <Link href={s.href} className="hover:text-teal">
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Plate>
      </div>

      {/* Dossiers + feed */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)] xl:items-start">
        <Plate className="p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Eyebrow>{C.tableEyebrow}</Eyebrow>
              <h2 className="mt-1.5 font-display text-xl font-semibold text-ink">
                {C.tableTitle}
              </h2>
            </div>
            <Link
              href={`${base}/decisions`}
              className="inline-flex items-center gap-1 text-sm text-teal hover:text-ink"
            >
              {C.allDecisions}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
          {active.length ? (
            <>
              {/* Phones: stacked cards */}
              <ul className="mt-4 divide-y divide-line sm:hidden">
                {active.slice(0, 6).map((x) => {
                  const agg = byDecision.get(x.id);
                  return (
                    <li key={x.id}>
                      <Link
                        href={`${base}/decisions/${x.id}`}
                        className="block py-3.5"
                      >
                        <span className="block font-medium text-ink">
                          {x.title}
                        </span>
                        <span className="mt-2 flex flex-wrap items-center gap-3">
                          <SeverityChip d={d} score={agg ? agg.max : null} />
                          <StatusBadge
                            status={x.status}
                            d={d}
                            analysis={x.latest_analysis}
                          />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <div className="-mx-5 mt-4 hidden overflow-x-auto sm:-mx-6 sm:block">
                <table className="w-full min-w-[38rem] text-left text-sm">
                  <thead>
                    <tr className="border-y border-line bg-white/[0.02] font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted">
                      <th className="px-5 py-2.5 font-medium sm:px-6">
                        {C.colDossier}
                      </th>
                      <th className="px-3 py-2.5 font-medium">
                        {C.colSeverity}
                      </th>
                      <th className="px-3 py-2.5 font-medium">{C.colAgents}</th>
                      <th className="px-3 py-2.5 font-medium">{C.colPhase}</th>
                      <th className="px-5 py-2.5 sm:px-6">
                        <span className="sr-only">{C.open}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {active.slice(0, 6).map((x) => {
                      const agg = byDecision.get(x.id);
                      const amount = formatAmount(x.amount, x.currency, lang);
                      return (
                        <tr key={x.id} className="hover:bg-white/[0.02]">
                          <td className="px-5 py-3.5 sm:px-6">
                            <Link
                              href={`${base}/decisions/${x.id}`}
                              className="font-medium text-ink hover:text-teal"
                            >
                              {x.title}
                            </Link>
                            <p className="mt-0.5 text-xs text-muted">
                              {d.decisions.categories[x.category]}
                              {amount && (
                                <span className="font-mono"> · {amount}</span>
                              )}
                            </p>
                          </td>
                          <td className="px-3 py-3.5">
                            <SeverityChip d={d} score={agg ? agg.max : null} />
                          </td>
                          <td className="px-3 py-3.5 font-mono text-xs text-muted">
                            {agg
                              ? `${agg.agents.size}/${engine?.agents_active.length || agg.agents.size}`
                              : "—"}
                          </td>
                          <td className="px-3 py-3.5">
                            <StatusBadge
                              status={x.status}
                              d={d}
                              analysis={x.latest_analysis}
                            />
                          </td>
                          <td className="px-5 py-3.5 text-right sm:px-6">
                            <Link
                              href={`${base}/decisions/${x.id}`}
                              className="text-xs text-teal hover:text-ink"
                            >
                              {C.open}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm text-muted">
              {d.overview.decisionsNone}
            </p>
          )}
          {findings.length > 0 && (
            <p className="mt-4 text-[0.7rem] leading-relaxed text-muted">
              {d.severityNote}
            </p>
          )}
        </Plate>

        <Plate className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-ink">
              <Siren className="size-5 text-teal" aria-hidden />
              {C.feedTitle}
            </h2>
            {audit.data && (
              <Link
                href={`${base}/activity`}
                className="text-xs text-teal hover:text-ink"
              >
                {C.feedAll}
              </Link>
            )}
          </div>
          {feed.length ? (
            <ol className="relative mt-5 space-y-4 before:absolute before:bottom-2 before:left-[0.95rem] before:top-2 before:w-px before:bg-line">
              {feed.map((item) =>
                item.kind === "alert" ? (
                  <li key={`a-${item.f.id}`} className="relative flex gap-3">
                    <span
                      className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-abyss ${LEVEL_TEXT[level(severity(item.f))]}`}
                    >
                      <ShieldAlert className="size-4" aria-hidden />
                    </span>
                    <Link
                      href={`${base}/decisions/${item.f.decision_id}`}
                      className="min-w-0 flex-1 rounded-xl border border-line bg-white/[0.02] p-3 hover:bg-white/[0.05]"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span
                          className={`text-sm font-medium ${LEVEL_TEXT[level(severity(item.f))]}`}
                        >
                          {item.f.title}
                        </span>
                        <span className="shrink-0 text-[0.68rem] text-muted">
                          <LocalTime iso={item.at} lang={lang} />
                        </span>
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted">
                        {fmt(C.byAgent, {
                          agent:
                            d.agentCatalog[
                              item.f.agent as keyof typeof d.agentCatalog
                            ]?.name ?? item.f.agent,
                        })}{" "}
                        · {item.f.decision_title}
                      </span>
                    </Link>
                  </li>
                ) : (
                  <li key={`e-${item.e.id}`} className="relative flex gap-3">
                    <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-abyss text-iris">
                      <Activity className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1 pt-1">
                      <p className="text-sm text-ink">
                        <span className="font-medium">
                          {item.e.actor_name ?? d.activity.system}
                        </span>{" "}
                        <span className="text-ink/80">
                          {describeAction(d, item.e)}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[0.68rem] text-muted">
                        <LocalTime iso={item.at} lang={lang} withTime />
                      </p>
                    </div>
                  </li>
                ),
              )}
            </ol>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-muted">
              {C.feedEmpty}
            </p>
          )}
        </Plate>
      </div>
    </>
  );
}

export default async function Page({
  params,
}: PageProps<"/[lang]/app/[orgId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview params={params} />
    </Suspense>
  );
}
