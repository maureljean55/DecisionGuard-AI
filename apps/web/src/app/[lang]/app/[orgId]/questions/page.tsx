import {
  ArrowLeft,
  ArrowRight,
  FileText,
  MessageCircleQuestion,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { AssistantChat } from "@/components/dashboard/assistant-chat";
import {
  ctaGhost,
  Eyebrow,
  PageHeader,
  Plate,
} from "@/components/dashboard/cockpit";
import { LocalTime } from "@/components/dashboard/local-time";
import { PageSkeleton } from "@/components/dashboard/page-title";
import { IndexChip } from "@/components/dashboard/risk";
import { formatAmount } from "@/components/dashboard/status";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { apiGet, getMe } from "@/lib/api";
import { loadOrg } from "@/lib/dash-data";
import type { Decision } from "@/lib/types";

async function Questions({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ lang: raw, orgId }, sp] = await Promise.all([params, searchParams]);
  if (!hasLocale(raw)) notFound();
  const lang: Locale = raw;
  const [me, dict, org] = await Promise.all([
    getMe(),
    getDictionary(lang),
    loadOrg(lang, orgId),
  ]);
  if (!me) redirect(`/${lang}/login`);
  const d = dict.dash;
  const Q = d.questions;
  const base = `/${lang}/app/${org.id}`;
  const decisions =
    (await apiGet<Decision[]>(`/orgs/${org.id}/decisions`)).data ?? [];
  const analysed = decisions.filter(
    (x) => x.latest_analysis?.status === "completed",
  );
  const wanted = typeof sp.dossier === "string" ? sp.dossier : null;
  const selected = analysed.find((x) => x.id === wanted) ?? null;

  if (!selected) {
    return (
      <>
        <PageHeader eyebrow={Q.eyebrow} title={Q.title} subtitle={Q.subtitle} />
        <h2 className="mb-3 font-display text-xl font-semibold text-ink">
          {Q.pick}
        </h2>
        {analysed.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl border border-line bg-abyss">
              <MessageCircleQuestion
                className="size-5 text-muted"
                aria-hidden
              />
            </span>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
              {Q.pickEmpty}
            </p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {analysed.map((x) => {
              const amount = formatAmount(x.amount, x.currency, lang);
              return (
                <li key={x.id}>
                  <Link
                    href={`${base}/questions?dossier=${x.id}`}
                    className="group flex h-full flex-col rounded-2xl border border-line bg-abyss/80 p-5 transition-colors hover:border-electric/40 hover:bg-[#111a31]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line bg-white/[0.03]">
                        <FileText className="size-4 text-teal" aria-hidden />
                      </span>
                      <IndexChip
                        d={d}
                        score={x.latest_analysis?.risk_score}
                        levelKey={x.latest_analysis?.risk_level}
                      />
                    </div>
                    <p className="mt-4 font-display text-lg font-semibold leading-snug text-ink group-hover:text-teal">
                      {x.title}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {d.decisions.categories[x.category]}
                      {amount ? ` · ${amount}` : ""}
                    </p>
                    <p className="mt-auto flex items-center justify-between pt-4 text-xs text-muted">
                      {x.latest_analysis?.finished_at && (
                        <LocalTime
                          iso={x.latest_analysis.finished_at}
                          lang={lang}
                        />
                      )}
                      <ArrowRight
                        className="size-4 text-teal transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </>
    );
  }

  const decisionHref = `${base}/decisions/${selected.id}`;
  return (
    <>
      <Link
        href={`${base}/questions`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {Q.change}
      </Link>
      <Plate className="mb-5 mt-4 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0">
          <Eyebrow live>{Q.eyebrow}</Eyebrow>
          <p className="mt-1 truncate font-display text-xl font-semibold text-ink">
            {selected.title}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <IndexChip
            d={d}
            score={selected.latest_analysis?.risk_score}
            levelKey={selected.latest_analysis?.risk_level}
          />
          <Link href={decisionHref} className={ctaGhost}>
            {Q.open}
          </Link>
        </div>
      </Plate>
      <AssistantChat
        key={selected.latest_analysis!.id}
        d={d}
        orgId={org.id}
        analysisId={selected.latest_analysis!.id}
        decisionHref={decisionHref}
        userName={me.user.full_name}
      />
    </>
  );
}

export default function Page({
  params,
  searchParams,
}: PageProps<"/[lang]/app/[orgId]/questions">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Questions params={params} searchParams={searchParams} />
    </Suspense>
  );
}
