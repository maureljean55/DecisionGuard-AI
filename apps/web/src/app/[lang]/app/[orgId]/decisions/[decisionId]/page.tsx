import { ArrowLeft, PencilLine } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { AgentResults } from "@/components/dashboard/agent-results";
import { AnalysisPanel } from "@/components/dashboard/analysis";
import { DecisionActions } from "@/components/dashboard/decisions";
import { LocalTime } from "@/components/dashboard/local-time";
import { PageSkeleton } from "@/components/dashboard/page-title";
import { formatAmount, StatusBadge } from "@/components/dashboard/status";
import { Panel } from "@/components/dashboard/ui";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { apiGet, getMe } from "@/lib/api";
import { loadOrg } from "@/lib/dash-data";
import { fmt } from "@/lib/format";
import { canDeleteDecision, canWriteDecisions } from "@/lib/permissions";
import type { Analysis, Decision } from "@/lib/types";

async function DecisionPage({
  params,
}: {
  params: Promise<{ lang: string; orgId: string; decisionId: string }>;
}) {
  const { lang: raw, orgId, decisionId } = await params;
  if (!hasLocale(raw)) notFound();
  const lang: Locale = raw;
  const [me, dict, org] = await Promise.all([
    getMe(),
    getDictionary(lang),
    loadOrg(lang, orgId),
  ]);
  if (!me) redirect(`/${lang}/login`);
  const res = await apiGet<Decision>(
    `/orgs/${org.id}/decisions/${encodeURIComponent(decisionId)}`,
  );
  if (!res.data) notFound();
  const x = res.data;
  const history =
    (await apiGet<Analysis[]>(`/orgs/${org.id}/decisions/${x.id}/analyses`))
      .data ?? [];
  const analysis = history[0] ?? null;
  const d = dict.dash;
  const T = d.decisions.detail;
  const amount = formatAmount(x.amount, x.currency, lang);

  return (
    <>
      <Link
        href={`/${lang}/app/${org.id}/decisions`}
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {T.back}
      </Link>
      <div className="mb-8 mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[2rem] font-medium leading-tight text-ink sm:text-[2.4rem]">
              {x.title}
            </h1>
            <StatusBadge status={x.status} d={d} analysis={x.latest_analysis} />
          </div>
          <p className="mt-2 text-sm text-muted">
            {x.created_by_name
              ? `${fmt(T.by, { name: x.created_by_name })} · `
              : ""}
            {T.updated} <LocalTime iso={x.updated_at} lang={lang} withTime />
          </p>
        </div>
        <DecisionActions
          d={d}
          lang={lang}
          orgId={org.id}
          decision={x}
          canWrite={canWriteDecisions(org.role)}
          canDelete={canDeleteDecision(
            org.role,
            x.created_by_user_id,
            me.user.id,
          )}
        />
      </div>
      {analysis && analysis.status !== "canceled" && (
        <div className="mb-6">
          <AnalysisPanel
            d={d}
            orgId={org.id}
            analysis={analysis}
            canWrite={canWriteDecisions(org.role)}
          />
        </div>
      )}
      {analysis && (
        <div className="mb-8">
          <AgentResults d={d} analysis={analysis} />
        </div>
      )}
      {x.status === "draft" && (
        <div className="mb-6 flex gap-3 rounded-2xl border border-line bg-abyss/60 px-5 py-4 text-sm text-muted">
          <PencilLine className="mt-0.5 size-4 shrink-0" aria-hidden />
          {T.draftNote}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title={T.description}>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">
              {x.description}
            </p>
          </Panel>
          <Panel title={T.context}>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink/90">
              {x.context ?? <span className="text-muted">{T.none}</span>}
            </p>
          </Panel>
        </div>
        <Panel>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs text-muted">{T.category}</dt>
              <dd className="mt-1 text-ink">
                {d.decisions.categories[x.category]}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{T.amount}</dt>
              <dd className="mt-1 font-mono text-ink">
                {amount ?? (
                  <span className="font-sans text-muted">{T.none}</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{T.deadline}</dt>
              <dd className="mt-1 text-ink">
                {x.deadline ? (
                  <LocalTime iso={`${x.deadline}T12:00:00Z`} lang={lang} />
                ) : (
                  <span className="text-muted">{T.none}</span>
                )}
              </dd>
            </div>
            {x.submitted_at && (
              <div>
                <dt className="text-xs text-muted">{T.submittedOn}</dt>
                <dd className="mt-1 text-ink">
                  <LocalTime iso={x.submitted_at} lang={lang} withTime />
                </dd>
              </div>
            )}
          </dl>
        </Panel>
      </div>
    </>
  );
}

export default function Page({
  params,
}: PageProps<"/[lang]/app/[orgId]/decisions/[decisionId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DecisionPage params={params} />
    </Suspense>
  );
}
