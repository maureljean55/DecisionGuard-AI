import { SlidersHorizontal } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  ctaGhost,
  Eyebrow,
  PageHeader,
  Plate,
} from "@/components/dashboard/cockpit";
import { PageSkeleton } from "@/components/dashboard/page-title";
import { SimulatorPanel } from "@/components/dashboard/simulator";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { apiGet } from "@/lib/api";
import { loadOrg } from "@/lib/dash-data";
import type { Analysis, Decision } from "@/lib/types";

async function Simulator({
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
  const S = d.simulator;
  const base = `/${lang}/app/${org.id}`;

  const decisions =
    (await apiGet<Decision[]>(`/orgs/${org.id}/decisions`)).data ?? [];
  const scored = decisions.filter(
    (x) =>
      x.latest_analysis?.status === "completed" &&
      x.latest_analysis.risk_score !== null,
  );
  const wanted = typeof sp.analysis === "string" ? sp.analysis : null;
  const selected =
    scored.find((x) => x.latest_analysis?.id === wanted) ?? scored[0] ?? null;
  const header = (
    <PageHeader eyebrow={S.eyebrow} title={S.title} subtitle={S.subtitle} />
  );

  if (!selected?.latest_analysis) {
    return (
      <>
        {header}
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl border border-line bg-abyss">
            <SlidersHorizontal className="size-5 text-muted" aria-hidden />
          </span>
          <p className="mt-4 font-medium text-ink">{S.emptyTitle}</p>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
            {S.emptyBody}
          </p>
        </div>
      </>
    );
  }

  const analysis = (
    await apiGet<Analysis>(
      `/orgs/${org.id}/analyses/${selected.latest_analysis.id}`,
    )
  ).data;
  if (
    !analysis ||
    analysis.risk_score === null ||
    !analysis.risk_level ||
    !analysis.risk_breakdown
  )
    notFound();
  const agents = analysis.agents
    .filter((r) => r.agent !== "audit" && r.findings.length > 0)
    .map((r) => r.agent);

  return (
    <>
      {header}
      <Plate className="mb-5 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <Eyebrow>{S.dossier}</Eyebrow>
          <p className="mt-0.5 truncate font-display text-lg font-semibold text-ink">
            {selected.title}
          </p>
        </div>
        {scored.length > 1 && (
          <form action={`${base}/simulator`} className="flex gap-2">
            <label htmlFor="sim-analysis" className="sr-only">
              {S.dossier}
            </label>
            <select
              id="sim-analysis"
              name="analysis"
              defaultValue={selected.latest_analysis.id}
              className="h-10 min-w-0 max-w-[16rem] rounded-xl border border-line bg-night/60 px-3 text-sm text-ink"
            >
              {scored.map((x) => (
                <option key={x.id} value={x.latest_analysis!.id}>
                  {x.title}
                </option>
              ))}
            </select>
            <button type="submit" className={ctaGhost}>
              {d.council.show}
            </button>
          </form>
        )}
      </Plate>
      <SimulatorPanel
        key={analysis.id}
        d={d}
        orgId={org.id}
        analysisId={analysis.id}
        baseline={analysis.risk_score}
        baselineLevel={analysis.risk_level}
        breakdown={analysis.risk_breakdown}
        scenarios={analysis.scenarios ?? []}
        agents={agents}
      />
    </>
  );
}

export default function Page({
  params,
  searchParams,
}: PageProps<"/[lang]/app/[orgId]/simulator">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Simulator params={params} searchParams={searchParams} />
    </Suspense>
  );
}
