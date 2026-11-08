import { ChevronRight, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LocalTime } from "@/components/dashboard/local-time";
import { PageSkeleton, PageTitle } from "@/components/dashboard/page-title";
import { formatAmount, StatusBadge } from "@/components/dashboard/status";
import { buttonPrimary } from "@/components/dashboard/ui";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { apiGet } from "@/lib/api";
import { loadOrg } from "@/lib/dash-data";
import { canWriteDecisions } from "@/lib/permissions";
import type { Decision } from "@/lib/types";

const TABS = ["active", "draft", "submitted", "archived"] as const;
type Tab = (typeof TABS)[number];

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
  const [dict, org] = await Promise.all([
    getDictionary(lang),
    loadOrg(lang, orgId),
  ]);
  const d = dict.dash;
  const query = tab === "active" ? "" : `?status=${tab}`;
  const res = await apiGet<Decision[]>(`/orgs/${org.id}/decisions${query}`);
  const items = res.data ?? [];
  const base = `/${lang}/app/${org.id}/decisions`;
  const writer = canWriteDecisions(org.role);

  return (
    <>
      <PageTitle
        title={d.decisions.title}
        subtitle={d.decisions.subtitle}
        action={
          writer && (
            <Link href={`${base}/new`} className={buttonPrimary}>
              <Plus className="size-4" aria-hidden />
              {d.decisions.new}
            </Link>
          )
        }
      />

      <nav
        aria-label={d.decisions.title}
        className="mb-6 flex gap-1 overflow-x-auto rounded-full border border-line bg-white/[0.02] p-1 text-sm sm:w-fit"
      >
        {TABS.map((t) => (
          <Link
            key={t}
            href={t === "active" ? base : `${base}?status=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 transition-colors ${t === tab ? "bg-white/[0.09] text-ink" : "text-muted hover:text-ink"}`}
          >
            {d.decisions.tabs[t]}
          </Link>
        ))}
      </nav>

      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl border border-line bg-abyss">
            <FileText className="size-5 text-muted" aria-hidden />
          </span>
          <p className="mt-4 font-medium text-ink">{d.decisions.empty}</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            {writer ? d.decisions.emptyCta : d.decisions.readOnly}
          </p>
          {writer && tab !== "archived" && (
            <Link href={`${base}/new`} className={`${buttonPrimary} mt-6`}>
              <Plus className="size-4" aria-hidden />
              {d.decisions.new}
            </Link>
          )}
        </div>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-abyss/70">
          {items.map((x) => {
            const amount = formatAmount(x.amount, x.currency, lang);
            return (
              <li key={x.id}>
                <Link
                  href={`${base}/${x.id}`}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/[0.03]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-ink group-hover:text-teal">
                        {x.title}
                      </p>
                      <StatusBadge
                        status={x.status}
                        d={d}
                        analysis={x.latest_analysis}
                      />
                    </div>
                    <p className="mt-1 truncate text-xs text-muted">
                      {d.decisions.categories[x.category]}
                      {amount ? ` · ${amount}` : ""}
                      {" · "}
                      <LocalTime iso={x.updated_at} lang={lang} />
                    </p>
                  </div>
                  <ChevronRight
                    className="size-4 shrink-0 text-muted"
                    aria-hidden
                  />
                </Link>
              </li>
            );
          })}
        </ul>
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
