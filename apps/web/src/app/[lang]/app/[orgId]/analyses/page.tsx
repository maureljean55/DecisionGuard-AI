import { BarChart3, Check, ChevronRight, Hourglass } from "lucide-react";
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
import type { Decision } from "@/lib/types";

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
  const queue =
    (await apiGet<Decision[]>(`/orgs/${org.id}/decisions?status=submitted`))
      .data ?? [];
  const base = `/${lang}/app/${org.id}/decisions`;

  return (
    <>
      <PageTitle title={A.title} subtitle={A.subtitle} />
      <div className="mb-6 flex items-center gap-2.5 rounded-2xl border border-line bg-abyss/60 px-5 py-3.5 text-sm text-muted">
        <Hourglass className="size-4 shrink-0 text-risk-moderate" aria-hidden />
        {A.status}
      </div>
      {queue.length ? (
        <div className="space-y-6">
          <Panel title={`${A.queueTitle} · ${queue.length}`}>
            <ul className="divide-y divide-line">
              {queue.map((x) => (
                <li key={x.id}>
                  <Link
                    href={`${base}/${x.id}`}
                    className="group flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink group-hover:text-teal">
                        {x.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {d.decisions.categories[x.category]} ·{" "}
                        {d.decisions.detail.submittedOn}{" "}
                        {x.submitted_at && (
                          <LocalTime iso={x.submitted_at} lang={lang} />
                        )}
                      </p>
                    </div>
                    <StatusBadge status={x.status} d={d} />
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
          body={A.queueEmpty}
          whatTitle={A.whatTitle}
          what={A.what}
        >
          <Link href={base} className={`${buttonGhost} mt-6`}>
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
