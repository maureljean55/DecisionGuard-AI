import { Grid3x3 } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import {
  ctaGhost,
  Eyebrow,
  PageHeader,
  Plate,
  SeverityChip,
} from "@/components/dashboard/cockpit";
import { PageSkeleton } from "@/components/dashboard/page-title";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { apiGet } from "@/lib/api";
import { loadOrg } from "@/lib/dash-data";
import { fmt } from "@/lib/format";
import { level, type Level, severity } from "@/lib/risk";
import type { OrgFinding } from "@/lib/types";

const SCALE = [1, 2, 3, 4, 5] as const;
const CELL: Record<Level, string> = {
  low: "bg-risk-low/[0.14] border-risk-low/25 hover:bg-risk-low/25",
  moderate:
    "bg-risk-moderate/[0.14] border-risk-moderate/25 hover:bg-risk-moderate/25",
  high: "bg-risk-high/[0.16] border-risk-high/30 hover:bg-risk-high/30",
  critical:
    "bg-risk-critical/[0.18] border-risk-critical/35 hover:bg-risk-critical/30",
};

function pick(v: string | string[] | undefined): number | null {
  const n = typeof v === "string" ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

async function RiskMap({
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
  const M = d.riskMap;
  const base = `/${lang}/app/${org.id}`;
  const findings =
    (await apiGet<OrgFinding[]>(`/orgs/${org.id}/findings`)).data ?? [];
  const l = pick(sp.l);
  const i = pick(sp.i);
  const selected = l && i;
  const count = (li: number, im: number) =>
    findings.filter((f) => f.likelihood === li && f.impact === im).length;
  const list = selected
    ? findings.filter((f) => f.likelihood === l && f.impact === i)
    : findings.slice(0, 10);

  return (
    <>
      <PageHeader eyebrow={M.eyebrow} title={M.title} subtitle={M.subtitle} />

      {findings.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl border border-line bg-abyss">
            <Grid3x3 className="size-5 text-muted" aria-hidden />
          </span>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
            {M.empty}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] xl:items-start">
          <Plate className="p-5 sm:p-6">
            <div className="flex gap-3">
              {/* Impact axis */}
              <div className="flex flex-col items-center">
                <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted [writing-mode:vertical-rl] rotate-180">
                  {M.impact} →
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1.5">
                  {[...SCALE].reverse().map((im) => (
                    <div key={im} className="contents">
                      <span
                        className="flex items-center justify-end pr-1.5 text-right text-[0.66rem] leading-tight text-muted"
                        title={M.scale.i[im - 1]}
                      >
                        <span className="hidden sm:inline">
                          {M.scale.i[im - 1]}
                        </span>
                        <span className="font-mono sm:hidden">{im}</span>
                      </span>
                      {SCALE.map((li) => {
                        const n = count(li, im);
                        const lv = level(li * im);
                        const isSel = l === li && i === im;
                        return (
                          <Link
                            key={li}
                            href={`${base}/risk-map?l=${li}&i=${im}`}
                            scroll={false}
                            aria-label={`${fmt(M.selected, { l: String(li), i: String(im) })} · ${fmt(M.cell, { n: String(n) })}`}
                            aria-current={isSel ? "true" : undefined}
                            className={`flex aspect-square items-center justify-center rounded-lg border text-sm transition-colors sm:aspect-[4/3] ${CELL[lv]} ${
                              isSel
                                ? "ring-2 ring-electric ring-offset-2 ring-offset-abyss"
                                : ""
                            } ${n ? "font-mono font-semibold text-ink" : "text-transparent"}`}
                          >
                            {n || "·"}
                          </Link>
                        );
                      })}
                    </div>
                  ))}
                  <span />
                  {SCALE.map((li) => (
                    <span
                      key={li}
                      className="pt-1.5 text-center text-[0.66rem] leading-tight text-muted"
                      title={M.scale.l[li - 1]}
                    >
                      <span className="hidden sm:inline">
                        {M.scale.l[li - 1]}
                      </span>
                      <span className="font-mono sm:hidden">{li}</span>
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-center font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
                  {M.likelihood} →
                </p>
              </div>
            </div>
            <p className="mt-5 text-[0.7rem] leading-relaxed text-muted">
              {d.severityNote}
            </p>
          </Plate>

          <Plate className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Eyebrow>
                {selected
                  ? fmt(M.selected, { l: String(l), i: String(i) })
                  : M.top}
              </Eyebrow>
              {selected && (
                <Link
                  href={`${base}/risk-map`}
                  scroll={false}
                  className="text-xs text-teal hover:text-ink"
                >
                  {M.clear}
                </Link>
              )}
            </div>
            {list.length ? (
              <ul className="mt-4 divide-y divide-line">
                {list.map((f) => (
                  <li key={f.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <Link
                        href={`${base}/decisions/${f.decision_id}`}
                        className="min-w-0 text-sm font-medium text-ink hover:text-teal"
                      >
                        {f.title}
                      </Link>
                      <SeverityChip d={d} score={severity(f)} />
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {d.agentCatalog[f.agent as keyof typeof d.agentCatalog]
                        ?.name ?? f.agent}{" "}
                      · {f.decision_title}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-muted">{M.pick}</p>
            )}
            {!selected && (
              <p className="mt-4 text-xs text-muted">{M.pick}</p>
            )}
            <Link href={`${base}/decisions`} className={`${ctaGhost} mt-5`}>
              {d.cockpit.allDecisions}
            </Link>
          </Plate>
        </div>
      )}
    </>
  );
}

export default function Page({
  params,
  searchParams,
}: PageProps<"/[lang]/app/[orgId]/risk-map">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <RiskMap params={params} searchParams={searchParams} />
    </Suspense>
  );
}
