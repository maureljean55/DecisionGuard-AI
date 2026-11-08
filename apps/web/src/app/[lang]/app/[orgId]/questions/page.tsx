import { MessageCircleQuestion } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { AssistantChat } from "@/components/dashboard/assistant-chat";
import { ctaGhost, PageHeader } from "@/components/dashboard/cockpit";
import { DossierPicker } from "@/components/dashboard/dossier-picker";
import { PageSkeleton } from "@/components/dashboard/page-title";
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
  const options = analysed.map((x) => ({
    id: x.id,
    title: x.title,
    category: d.decisions.categories[x.category],
    score: x.latest_analysis?.risk_score ?? null,
    level: x.latest_analysis?.risk_level ?? null,
  }));

  return (
    <>
      <PageHeader eyebrow={Q.eyebrow} title={Q.title} subtitle={Q.subtitle} />

      {analysed.length === 0 ? (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <span className="flex size-12 items-center justify-center rounded-xl border border-line bg-abyss">
            <MessageCircleQuestion className="size-5 text-muted" aria-hidden />
          </span>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
            {Q.pickEmpty}
          </p>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <DossierPicker
              d={d}
              options={options}
              selectedId={selected?.id ?? null}
              basePath={`${base}/questions`}
            />
            {selected && (
              <Link
                href={`${base}/decisions/${selected.id}`}
                className={`${ctaGhost} shrink-0`}
              >
                {Q.open}
              </Link>
            )}
          </div>

          {selected ? (
            <AssistantChat
              key={selected.latest_analysis!.id}
              d={d}
              orgId={org.id}
              analysisId={selected.latest_analysis!.id}
              decisionHref={`${base}/decisions/${selected.id}`}
              userName={me.user.full_name}
            />
          ) : (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl border border-line bg-abyss">
                <MessageCircleQuestion
                  className="size-5 text-teal"
                  aria-hidden
                />
              </span>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
                {Q.pickHint}
              </p>
            </div>
          )}
        </>
      )}
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
