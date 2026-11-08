import { BarChart3, Check, ChevronRight, Gauge } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ModuleEmpty } from "@/components/dashboard/explainer";
import { LocalTime } from "@/components/dashboard/local-time";
import { PageSkeleton, PageTitle } from "@/components/dashboard/page-title";
import { StatusBadge } from "@/components/dashboard/status";
import { buttonGhost, Panel } from "@/components/dashboard/ui";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { apiGet } from "@/lib/api";
import { loadOrg } from "@/lib/dash-data";
import { fmt } from "@/lib/format";
import type { Analysis, Usage } from "@/lib/types";

async function Analyses({
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
  const A = d.analyses;
  const N = d.analysis;
  const [list, usage] = await Promise.all([
    apiGet<Analysis[]>(`/orgs/${org.id}/analyses`),
    apiGet<Usage>(`/orgs/${org.id}/usage`),
  ]);
  const items = (list.data ?? []).filter((a) => a.status !== "canceled");
  const u = usage.data;
  const pct = u?.limit
    ? Math.min(100, Math.round((u.used / u.limit) * 100))
    : 0;

  return (
    <>
      <PageTitle title={A.title} subtitle={A.subtitle} />

      {u && (
        <div className="mb-6 rounded-2xl border border-line bg-abyss/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-muted">
              <Gauge className="size-4 text-teal" aria-hidden />
              {N.usage}
            </span>
            <span className="font-mono text-ink">
              {u.limit === null
                ? `${u.used} · ${N.unlimited}`
                : fmt(N.usageValue, {
                    used: String(u.used),
                    limit: String(u.limit),
                  })}
            </span>
          </div>
          {u.limit !== null && (
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-line"
              aria-hidden
            >
              <div
                className={`h-full rounded-full ${pct >= 100 ? "bg-risk-critical" : pct >= 80 ? "bg-risk-moderate" : "bg-teal"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
      )}

      {items.length ? (
        <div className="space-y-6">
          <Panel title={`${N.queueTitle} · ${items.length}`}>
            <ul className="divide-y divide-line">
              {items.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/${lang}/app/${org.id}/decisions/${a.decision_id}`}
                    className="group flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink group-hover:text-teal">
                        {a.decision_title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        <LocalTime iso={a.created_at} lang={lang} withTime />
                        {a.attempts > 1 ? ` · ${a.attempts} ${N.attempt}` : ""}
                      </p>
                    </div>
                    <StatusBadge status="submitted" d={d} analysis={a} />
                    <ChevronRight
                      className="size-4 shrink-0 text-muted"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title={A.whatTitle}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {A.what.map((w) => (
                <li
                  key={w}
                  className="flex gap-2.5 text-sm leading-relaxed text-ink/85"
                >
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-teal"
                    aria-hidden
                  />
                  {w}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : (
        <ModuleEmpty
          icon={BarChart3}
          title={A.queueTitle}
          body={N.empty}
          whatTitle={A.whatTitle}
          what={A.what}
        >
          <Link
            href={`/${lang}/app/${org.id}/decisions`}
            className={`${buttonGhost} mt-6`}
          >
            {A.goDecisions}
          </Link>
        </ModuleEmpty>
      )}
    </>
  );
}

export default function Page({
  params,
}: PageProps<"/[lang]/app/[orgId]/analyses">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Analyses params={params} />
    </Suspense>
  );
}
