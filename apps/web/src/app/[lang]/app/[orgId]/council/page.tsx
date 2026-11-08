import {
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  Gauge,
  ListChecks,
  Lock,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AgentResults } from "@/components/dashboard/agent-results";
import {
  ctaGhost,
  Eyebrow,
  KpiTile,
  PageHeader,
  Plate,
  SeverityChip,
} from "@/components/dashboard/cockpit";
import { PageSkeleton } from "@/components/dashboard/page-title";
import { IndexChip } from "@/components/dashboard/risk";
import { formatAmount } from "@/components/dashboard/status";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { AGENT_CATALOG } from "@/lib/agents";
import { apiGet } from "@/lib/api";
import { loadOrg } from "@/lib/dash-data";
import { fmt } from "@/lib/format";
import { level, LEVEL_FILL, severity } from "@/lib/risk";
import type { Analysis, Decision, EvidenceType } from "@/lib/types";

const EVIDENCE: EvidenceType[] = [
  "fact",
  "estimate",
  "assumption",
  "ai_hypothesis",
];
const EVIDENCE_FILL: Record<EvidenceType, string> = {
  fact: "bg-teal",
  estimate: "bg-iris",
  assumption: "bg-muted/60",
  ai_hypothesis: "bg-violet",
};

async function Council({
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
  const K = d.council;
  const base = `/${lang}/app/${org.id}`;

  const decisions =
    (await apiGet<Decision[]>(`/orgs/${org.id}/decisions`)).data ?? [];
  const analysed = decisions.filter(
    (x) => x.latest_analysis?.status === "completed",
  );
  const wanted = typeof sp.decision === "string" ? sp.decision : null;
  const selected = analysed.find((x) => x.id === wanted) ?? analysed[0] ?? null;

  const header = (
    <PageHeader
      eyebrow={K.eyebrow}
      title={K.title}
      subtitle={K.subtitle}
      actions={
        <Link href={`${base}/analyses`} className={ctaGhost}>
          <ListChecks className="size-4" aria-hidden />
          {K.queue}
        </Link>
      }
    />
  );

  if (!selected) {
    return (
      <>
        {header}
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl border border-line bg-abyss">
            <UsersRound className="size-5 text-muted" aria-hidden />
          </span>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
            {K.empty}
          </p>
        </div>
      </>
    );
  }

  const history =
    (
      await apiGet<Analysis[]>(
        `/orgs/${org.id}/decisions/${selected.id}/analyses`,
      )
    ).data ?? [];
  const analysis = history.find((a) => a.status === "completed") ?? null;
  if (!analysis) notFound();

  const runs = new Map(analysis.agents.map((r) => [r.agent, r]));
  const all = analysis.agents.flatMap((r) => r.findings);
  const done = analysis.agents.filter(
    (r) => r.status === "completed" && r.agent !== "audit",
  );
  const liveCount =
    analysis.agents.length + (analysis.scenarios?.length ? 1 : 0);
  const facts = all.filter((f) => f.evidence_type === "fact").length;
  const confidences = done
    .map((r) => r.confidence)
    .filter((c): c is "low" | "medium" | "high" => c !== null);
  const rank = { low: 0, medium: 1, high: 2 } as const;
  // Report the most cautious stated confidence: the weakest link.
  const confidence = confidences.length
    ? confidences.reduce((a, b) => (rank[b] < rank[a] ? b : a))
    : null;
  const amount = formatAmount(selected.amount, selected.currency, lang);

  return (
    <>
      {header}

      {/* Dossier selector */}
      <Plate className="mb-5 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-teal/30 bg-teal/10">
            <UsersRound className="size-4 text-teal" aria-hidden />
          </span>
          <div className="min-w-0">
            <Eyebrow>{K.dossier}</Eyebrow>
            <Link
              href={`${base}/decisions/${selected.id}`}
              className="mt-0.5 block truncate font-display text-lg font-semibold text-ink hover:text-teal"
            >
              {selected.title}
            </Link>
          </div>
          {amount && (
            <span className="hidden shrink-0 rounded-lg border border-line px-2.5 py-1 font-mono text-xs text-ink md:inline">
              {amount}
            </span>
          )}
        </div>
        {analysed.length > 1 && (
          <form action={`${base}/council`} className="flex gap-2">
            <label htmlFor="council-decision" className="sr-only">
              {K.dossier}
            </label>
            <select
              id="council-decision"
              name="decision"
              defaultValue={selected.id}
              className="h-10 min-w-0 max-w-[16rem] rounded-xl border border-line bg-night/60 px-3 text-sm text-ink focus:border-electric/50 focus:outline-none"
            >
              {analysed.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </select>
            <button type="submit" className={ctaGhost}>
              {K.show}
            </button>
          </form>
        )}
      </Plate>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiTile
          label={K.findings}
          value={all.length}
          icon={ListChecks}
          sub={fmt(K.findingsSub, { n: String(done.length) })}
        />
        <KpiTile
          label={K.facts}
          value={all.length ? Math.round((facts / all.length) * 100) : "—"}
          unit={all.length ? "%" : undefined}
          tone="text-teal"
          icon={BadgeCheck}
          sub={K.factsSub}
        />
        <KpiTile
          label={K.confidence}
          value={
            <span className="text-[1.7rem]">
              {confidence ? d.results.levels[confidence] : "—"}
            </span>
          }
          icon={Gauge}
          sub={K.confidenceSub}
        />
      </div>

      {/* Composition */}
      <div className="mb-3 mt-7 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ink">
          {K.composition}
        </h2>
        <span className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-muted">
          {fmt(K.live, {
            n: String(liveCount),
            total: String(AGENT_CATALOG.length),
          })}
        </span>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {AGENT_CATALOG.map((a) => {
          const run = runs.get(a.key);
          const info = d.agentCatalog[a.key];
          if (a.key === "scenarios" && analysis.scenarios?.length) {
            return (
              <li
                key={a.key}
                className="relative flex flex-col overflow-hidden rounded-2xl border border-line bg-abyss/80 p-5"
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-0.5 bg-iris"
                />
                <p className="font-display text-lg font-semibold text-ink">
                  {info.name}
                </p>
                <p className="text-xs text-muted">{info.angle}</p>
                <ul className="mt-4 space-y-2">
                  {analysis.scenarios.map((sc) => (
                    <li
                      key={sc.key}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="text-ink/85">
                        {d.risk.scenario[sc.key]}
                      </span>
                      <IndexChip d={d} score={sc.score} levelKey={sc.level} />
                    </li>
                  ))}
                </ul>
                <Link
                  href={`${base}/simulator?analysis=${analysis.id}`}
                  className="mt-auto pt-4 text-xs text-teal hover:text-ink"
                >
                  {d.risk.simulate}
                </Link>
              </li>
            );
          }
          if (a.key === "audit" && run) {
            const verdicts = all.map((f) => f.audit_status);
            return (
              <li
                key={a.key}
                className="relative flex flex-col overflow-hidden rounded-2xl border border-line bg-abyss/80 p-5"
              >
                <span
                  aria-hidden
                  className={`absolute inset-x-0 top-0 h-0.5 ${run.status === "failed" ? "bg-risk-critical" : "bg-teal"}`}
                />
                <p className="font-display text-lg font-semibold text-ink">
                  {info.name}
                </p>
                <p className="text-xs text-muted">{info.angle}</p>
                <p className="mt-4 line-clamp-5 text-sm leading-relaxed text-ink/85">
                  {run.status === "completed"
                    ? run.summary
                    : fmt(d.audit.failed, { code: run.error_code ?? "error" })}
                </p>
                {run.status === "completed" && (
                  <p className="mt-auto pt-4 font-mono text-[0.68rem] text-muted">
                    {fmt(d.audit.counts, {
                      s: String(
                        verdicts.filter((v) => v === "supported").length,
                      ),
                      w: String(verdicts.filter((v) => v === "weak").length),
                      u: String(
                        verdicts.filter((v) => v === "unsupported").length,
                      ),
                    })}
                  </p>
                )}
              </li>
            );
          }
          if (!run) {
            return (
              <li
                key={a.key}
                className="flex flex-col rounded-2xl border border-dashed border-line p-5 opacity-70"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-display text-lg font-semibold text-ink">
                    {info.name}
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-md border border-line px-1.5 py-0.5 font-mono text-[0.64rem] text-muted">
                    <Lock className="size-3" aria-hidden />
                    {fmt(K.plannedTag, { m: a.milestone })}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {info.angle}
                </p>
                <p className="mt-auto pt-4 text-xs text-muted/80">
                  {fmt(K.plannedBody, { m: a.milestone })}
                </p>
              </li>
            );
          }
          const max = run.findings.reduce(
            (m, f) => Math.max(m, severity(f)),
            0,
          );
          return (
            <li
              key={a.key}
              className="relative flex flex-col overflow-hidden rounded-2xl border border-line bg-abyss/80 p-5"
            >
              <span
                aria-hidden
                className={`absolute inset-x-0 top-0 h-0.5 ${
                  run.status === "failed"
                    ? "bg-risk-critical"
                    : max
                      ? LEVEL_FILL[level(max)]
                      : "bg-teal"
                }`}
              />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold text-ink">
                    {info.name}
                  </p>
                  <p className="text-xs text-muted">{info.angle}</p>
                </div>
                {run.status === "completed" && (
                  <SeverityChip d={d} score={max || null} />
                )}
              </div>
              {run.status === "failed" ? (
                <p className="mt-4 flex gap-2 text-sm text-muted">
                  <CircleAlert
                    className="mt-0.5 size-4 shrink-0 text-risk-high"
                    aria-hidden
                  />
                  {K.failed} ({run.error_code ?? "error"})
                </p>
              ) : (
                <p className="mt-4 line-clamp-5 text-sm leading-relaxed text-ink/85">
                  {run.summary}
                </p>
              )}
              <div className="mt-auto pt-4">
                <div className="flex items-center justify-between font-mono text-[0.64rem] uppercase tracking-[0.12em] text-muted">
                  <span>{K.maxSeverity}</span>
                  <span>
                    {fmt(K.findingsN, { n: String(run.findings.length) })}
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
              </div>
            </li>
          );
        })}
      </ul>

      {/* Evidence mix */}
      {all.length > 0 && (
        <Plate className="mt-5 p-5">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
            {K.evidenceMix}
          </p>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
            {EVIDENCE.map((e) => {
              const n = all.filter((f) => f.evidence_type === e).length;
              return n ? (
                <span
                  key={e}
                  className={EVIDENCE_FILL[e]}
                  style={{ width: `${(n / all.length) * 100}%` }}
                />
              ) : null;
            })}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted">
            {EVIDENCE.map((e) => (
              <li key={e} className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${EVIDENCE_FILL[e]}`} />
                {d.results.evidence[e]}
                <span className="font-mono text-ink">
                  {all.filter((f) => f.evidence_type === e).length}
                </span>
              </li>
            ))}
          </ul>
        </Plate>
      )}

      <div className="mt-8">
        <AgentResults d={d} analysis={analysis} />
      </div>
      <Link
        href={`${base}/decisions/${selected.id}`}
        className={`${ctaGhost} mt-6`}
      >
        {K.detail}
        <ArrowRight className="size-4" aria-hidden />
      </Link>
    </>
  );
}

export default function Page({
  params,
  searchParams,
}: PageProps<"/[lang]/app/[orgId]/council">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Council params={params} searchParams={searchParams} />
    </Suspense>
  );
}
