import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader,
  Plus,
  Search,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  ctaGhost,
  ctaPrimary,
  Eyebrow,
  KpiTile,
  PageHeader,
  Plate,
  SeverityChip,
} from "@/components/dashboard/cockpit";
import { LocalTime } from "@/components/dashboard/local-time";
import { PageSkeleton } from "@/components/dashboard/page-title";
import { IndexChip } from "@/components/dashboard/risk";
import { formatAmount, StatusBadge } from "@/components/dashboard/status";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { AGENT_CATALOG } from "@/lib/agents";
import { apiGet } from "@/lib/api";
import { loadOrg } from "@/lib/dash-data";
import { fmt } from "@/lib/format";
import { canWriteDecisions } from "@/lib/permissions";
import { level, LEVEL_FILL, MAJOR, severity } from "@/lib/risk";
import type { Decision, EngineStatus, OrgFinding } from "@/lib/types";

const TABS = ["active", "draft", "submitted", "archived"] as const;
type Tab = (typeof TABS)[number];
const RUNNING = [
  "pending",
  "analyzing",
  "simulating",
  "verifying",
  "reporting",
];

async function Decisions({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ lang: raw, orgId }, sp] = await Promise.all([params, searchParams]);
  if (!hasLocale(raw)) notFound();
  const lang: Locale = raw;
  const tab: Tab = TABS.includes(sp.status as Tab)
    ? (sp.status as Tab)
    : "active";
  const q = (typeof sp.q === "string" ? sp.q : "").trim();
  const [dict, org] = await Promise.all([
    getDictionary(lang),
    loadOrg(lang, orgId),
  ]);
  const d = dict.dash;
  const S = d.dossiers;
  const [activeRes, archivedRes, findingsRes, engineRes] = await Promise.all([
    apiGet<Decision[]>(`/orgs/${org.id}/decisions`),
    apiGet<Decision[]>(`/orgs/${org.id}/decisions?status=archived`),
    apiGet<OrgFinding[]>(`/orgs/${org.id}/findings`),
    apiGet<EngineStatus>("/engine"),
  ]);
  const active = activeRes.data ?? [];
  const archived = archivedRes.data ?? [];
  const findings = findingsRes.data ?? [];
  const liveAgents = AGENT_CATALOG.filter(
    (a) =>
      engineRes.data?.agents_active.includes(a.key) ||
      findings.some((f) => f.agent === a.key),
  );
  const base = `/${lang}/app/${org.id}/decisions`;
  const writer = canWriteDecisions(org.role);

  // --- Figures
  let engaged = 0;
  let otherCurrencies = 0;
  for (const x of active) {
    if (x.amount === null) continue;
    if (x.currency === org.currency) engaged += Number(x.amount);
    else otherCurrencies += 1;
  }
  const running = active.filter((x) =>
    RUNNING.includes(x.latest_analysis?.status ?? ""),
  ).length;
  const awaiting = active.filter(
    (x) => x.latest_analysis?.status === "collecting_info",
  ).length;
  const completed = active.filter(
    (x) => x.latest_analysis?.status === "completed",
  ).length;
  const major = findings.filter((f) => severity(f) >= MAJOR).length;

  const byDecision = new Map<string, OrgFinding[]>();
  for (const f of findings)
    byDecision.set(f.decision_id, [
      ...(byDecision.get(f.decision_id) ?? []),
      f,
    ]);
  const maxOf = (id: string) =>
    (byDecision.get(id) ?? []).reduce((m, f) => Math.max(m, severity(f)), 0);

  // --- Filtering
  const counts: Record<Tab, number> = {
    active: active.length,
    draft: active.filter((x) => x.status === "draft").length,
    submitted: active.filter((x) => x.status === "submitted").length,
    archived: archived.length,
  };
  const pool =
    tab === "archived"
      ? archived
      : tab === "active"
        ? active
        : active.filter((x) => x.status === tab);
  const needle = q.toLocaleLowerCase(lang);
  const items = needle
    ? pool.filter((x) =>
        `${x.title} ${x.description}`.toLocaleLowerCase(lang).includes(needle),
      )
    : pool;
  const featured =
    tab === "archived"
      ? null
      : ([...items]
          .filter((x) => (x.latest_analysis?.risk_score ?? null) !== null)
          .sort(
            (a, b) =>
              (b.latest_analysis?.risk_score ?? 0) -
              (a.latest_analysis?.risk_score ?? 0),
          )[0] ?? null);
  const others = items.filter((x) => x.id !== featured?.id);
  const href = (t: Tab) => {
    const params = new URLSearchParams();
    if (t !== "active") params.set("status", t);
    if (q) params.set("q", q);
    const s = params.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <>
      <PageHeader
        eyebrow={S.eyebrow}
        title={S.title}
        subtitle={S.subtitle}
        actions={
          writer && (
            <Link href={`${base}/new`} className={ctaPrimary}>
              <Plus className="size-4" aria-hidden />
              {d.decisions.new}
            </Link>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label={S.engaged}
          value={
            <span className="text-[1.7rem]">
              {formatAmount(String(engaged), org.currency, lang)}
            </span>
          }
          icon={Banknote}
          sub={
            <>
              {fmt(S.engagedSub, { cur: org.currency })}
              {otherCurrencies > 0 &&
                ` · ${fmt(S.engagedOther, { n: String(otherCurrencies) })}`}
            </>
          }
        />
        <KpiTile
          label={S.inAnalysis}
          value={running + awaiting}
          icon={Loader}
          sub={fmt(S.inAnalysisSub, { q: String(awaiting) })}
        />
        <KpiTile
          label={S.major}
          value={major}
          tone={major ? "text-risk-critical" : "text-ink"}
          icon={ShieldAlert}
          sub={S.majorSub}
        />
        <KpiTile
          label={S.done}
          value={completed}
          tone="text-teal"
          icon={CheckCircle2}
          sub={S.doneSub}
        />
      </div>

      {/* Filters */}
      <Plate className="mt-5 flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
        <form action={base} role="search" className="relative lg:w-80">
          {tab !== "active" && (
            <input type="hidden" name="status" value={tab} />
          )}
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <label htmlFor="dossier-q" className="sr-only">
            {S.search}
          </label>
          <input
            id="dossier-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder={S.search}
            className="h-10 w-full rounded-xl border border-line bg-night/60 pl-10 pr-3 text-sm text-ink placeholder:text-muted/80 focus:border-electric/50 focus:outline-none focus:ring-2 focus:ring-electric/20"
          />
        </form>
        <nav
          aria-label={d.decisions.title}
          className="flex gap-1 overflow-x-auto text-sm"
        >
          {TABS.map((t) => (
            <Link
              key={t}
              href={href(t)}
              aria-current={t === tab ? "page" : undefined}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 transition-colors ${
                t === tab
                  ? "bg-electric/[0.14] text-ink"
                  : "text-muted hover:bg-white/[0.04] hover:text-ink"
              }`}
            >
              {d.decisions.tabs[t]}
              <span
                className={`rounded-md px-1.5 font-mono text-[0.68rem] ${t === tab ? "bg-electric/30 text-ink" : "bg-white/[0.06]"}`}
              >
                {counts[t]}
              </span>
            </Link>
          ))}
        </nav>
      </Plate>

      {items.length === 0 ? (
        <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl border border-line bg-abyss">
            <FileText className="size-5 text-muted" aria-hidden />
          </span>
          <p className="mt-4 font-medium text-ink">
            {q || counts[tab] ? S.noMatch : d.decisions.empty}
          </p>
          {!q && !counts[tab] && (
            <p className="mt-1 max-w-sm text-sm text-muted">
              {writer ? d.decisions.emptyCta : d.decisions.readOnly}
            </p>
          )}
          {writer && !q && tab !== "archived" && (
            <Link href={`${base}/new`} className={`${ctaPrimary} mt-6`}>
              <Plus className="size-4" aria-hidden />
              {d.decisions.new}
            </Link>
          )}
        </div>
      ) : (
        <>
          {featured && (
            <Plate className="mt-5 p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Eyebrow>{S.featured}</Eyebrow>
                <span className="rounded-md border border-line px-1.5 py-0.5 text-[0.68rem] text-muted">
                  {d.decisions.categories[featured.category]}
                </span>
                <StatusBadge
                  status={featured.status}
                  d={d}
                  analysis={featured.latest_analysis}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 max-w-3xl">
                  <h2 className="font-display text-2xl font-semibold leading-tight text-ink sm:text-[1.75rem]">
                    {featured.title}
                  </h2>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink/80">
                    {featured.description}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted">
                    {d.risk.title}
                  </p>
                  <div className="mt-1.5 flex justify-end">
                    <IndexChip
                      d={d}
                      score={featured.latest_analysis?.risk_score}
                      levelKey={featured.latest_analysis?.risk_level}
                    />
                  </div>
                  <p className="mt-3 font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted">
                    {S.amount}
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold text-teal">
                    {formatAmount(featured.amount, featured.currency, lang) ??
                      S.noAmount}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                <div className="rounded-xl border border-line bg-night/50 p-4">
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted">
                    {S.riskByAgent}
                  </p>
                  <ul className="mt-3 space-y-3">
                    {liveAgents.map((a) => {
                      const mine = (byDecision.get(featured.id) ?? []).filter(
                        (f) => f.agent === a.key,
                      );
                      const max = mine.reduce(
                        (m, f) => Math.max(m, severity(f)),
                        0,
                      );
                      return (
                        <li key={a.key}>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-ink">
                              {d.agentCatalog[a.key].name}
                            </span>
                            <span className="font-mono text-muted">
                              {max ? `${max}/25` : "—"}
                            </span>
                          </div>
                          <div className="mt-1.5 h-1.5 rounded-full bg-white/[0.06]">
                            {max > 0 && (
                              <div
                                className={`h-full rounded-full ${LEVEL_FILL[level(max)]}`}
                                style={{ width: `${(max / 25) * 100}%` }}
                              />
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="rounded-xl border border-line bg-night/50 p-4">
                  <p className="font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted">
                    {S.topFindings}
                  </p>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {(byDecision.get(featured.id) ?? [])
                      .slice(0, 4)
                      .map((f) => (
                        <li
                          key={f.id}
                          className="rounded-lg border border-line bg-white/[0.02] p-2.5"
                        >
                          <p className="flex items-start justify-between gap-2">
                            <span className="text-[0.8rem] font-medium leading-snug text-ink">
                              {f.title}
                            </span>
                            <span
                              className={`mt-1 size-1.5 shrink-0 rounded-full ${LEVEL_FILL[level(severity(f))]}`}
                            />
                          </p>
                          <p className="mt-1 text-[0.7rem] text-muted">
                            {d.agentCatalog[
                              f.agent as keyof typeof d.agentCatalog
                            ]?.name ?? f.agent}{" "}
                            · {severity(f)}/25
                          </p>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`${base}/${featured.id}`} className={ctaGhost}>
                  {S.open}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link
                  href={`/${lang}/app/${org.id}/council?decision=${featured.id}`}
                  className={ctaGhost}
                >
                  <UsersRound className="size-4" aria-hidden />
                  {S.council}
                </Link>
              </div>
            </Plate>
          )}

          {others.length > 0 && (
            <>
              {featured && (
                <p className="mb-3 mt-7 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted">
                  {S.others}
                </p>
              )}
              <ul className={`space-y-2.5 ${featured ? "" : "mt-5"}`}>
                {others.map((x) => {
                  const amount = formatAmount(x.amount, x.currency, lang);
                  const max = maxOf(x.id);
                  return (
                    <li key={x.id}>
                      <Link
                        href={`${base}/${x.id}`}
                        className="group grid items-center gap-x-5 gap-y-2 rounded-2xl border border-line bg-abyss/80 px-4 py-4 transition-colors hover:border-electric/30 hover:bg-[#111a31] sm:grid-cols-[auto_minmax(0,1fr)_8rem_9rem_auto] sm:px-5"
                      >
                        <span className="hidden size-10 items-center justify-center rounded-xl border border-line bg-white/[0.03] sm:flex">
                          <FileText className="size-4 text-teal" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-medium text-ink group-hover:text-teal">
                              {x.title}
                            </span>
                            <StatusBadge
                              status={x.status}
                              d={d}
                              analysis={x.latest_analysis}
                            />
                          </span>
                          <span className="mt-1 block truncate text-xs text-muted">
                            {d.decisions.categories[x.category]} ·{" "}
                            <LocalTime iso={x.updated_at} lang={lang} />
                          </span>
                        </span>
                        <span className="text-xs">
                          <span className="block font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                            {S.amount}
                          </span>
                          <span className="font-mono text-ink">
                            {amount ?? S.noAmount}
                          </span>
                        </span>
                        <span className="text-xs">
                          <span className="block font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                            {d.risk.colIndex}
                          </span>
                          {x.latest_analysis?.risk_score != null ? (
                            <IndexChip
                              d={d}
                              score={x.latest_analysis.risk_score}
                              levelKey={x.latest_analysis.risk_level}
                            />
                          ) : max ? (
                            <SeverityChip d={d} score={max} />
                          ) : (
                            <span className="text-muted">{S.notAnalysed}</span>
                          )}
                        </span>
                        <ChevronRight
                          className="hidden size-4 text-muted sm:block"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {findings.length > 0 && (
            <p className="mt-5 text-[0.7rem] leading-relaxed text-muted">
              {d.severityNote}
            </p>
          )}
        </>
      )}
    </>
  );
}

export default function Page({
  params,
  searchParams,
}: PageProps<"/[lang]/app/[orgId]/decisions">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Decisions params={params} searchParams={searchParams} />
    </Suspense>
  );
}
