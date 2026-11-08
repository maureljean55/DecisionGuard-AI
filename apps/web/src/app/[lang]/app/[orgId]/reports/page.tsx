import { Download, ScrollText } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ctaGhost, PageHeader, Plate } from "@/components/dashboard/cockpit";
import { ModuleEmpty } from "@/components/dashboard/explainer";
import { LocalTime } from "@/components/dashboard/local-time";
import { PageSkeleton } from "@/components/dashboard/page-title";
import { IndexChip } from "@/components/dashboard/risk";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { apiGet } from "@/lib/api";
import { loadOrg } from "@/lib/dash-data";
import type { Analysis } from "@/lib/types";

async function Reports({
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
  const M = d.reports;
  const analyses =
    (await apiGet<Analysis[]>(`/orgs/${org.id}/analyses`)).data ?? [];
  const done = analyses.filter(
    (a) => a.status === "completed" && a.risk_score !== null,
  );

  return (
    <>
      <PageHeader
        eyebrow={d.nav.reports}
        title={M.title}
        subtitle={M.subtitle}
      />
      {done.length === 0 ? (
        <ModuleEmpty
          icon={ScrollText}
          title={M.empty}
          body={M.emptyBody}
          whatTitle={M.whatTitle}
          what={M.what}
        />
      ) : (
        <Plate>
          <ul className="divide-y divide-line">
            {done.map((a) => (
              <li
                key={a.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <Link
                    href={`/${lang}/app/${org.id}/decisions/${a.decision_id}`}
                    className="block truncate font-medium text-ink hover:text-teal"
                  >
                    {a.decision_title}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {M.finished}{" "}
                    {a.finished_at && (
                      <LocalTime iso={a.finished_at} lang={lang} withTime />
                    )}
                    {a.simulated && (
                      <span className="ml-2 text-risk-moderate">
                        · {d.cockpit.simulated}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <IndexChip
                    d={d}
                    score={a.risk_score}
                    levelKey={a.risk_level}
                  />
                  <a
                    href={`/api/orgs/${org.id}/analyses/${a.id}/report.pdf`}
                    className={`${ctaGhost} py-1.5`}
                  >
                    <Download className="size-4" aria-hidden />
                    {M.download}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </Plate>
      )}
    </>
  );
}

export default function Page({
  params,
}: PageProps<"/[lang]/app/[orgId]/reports">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Reports params={params} />
    </Suspense>
  );
}
