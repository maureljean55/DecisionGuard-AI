import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DecisionForm } from "@/components/dashboard/decisions";
import { PageSkeleton, PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/dashboard/ui";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { apiGet } from "@/lib/api";
import { loadOrg } from "@/lib/dash-data";
import { canWriteDecisions } from "@/lib/permissions";
import type { Decision } from "@/lib/types";

async function EditDecision({
  params,
}: {
  params: Promise<{ lang: string; orgId: string; decisionId: string }>;
}) {
  const { lang: raw, orgId, decisionId } = await params;
  if (!hasLocale(raw)) notFound();
  const lang: Locale = raw;
  const [dict, org] = await Promise.all([
    getDictionary(lang),
    loadOrg(lang, orgId),
  ]);
  const res = await apiGet<Decision>(
    `/orgs/${org.id}/decisions/${encodeURIComponent(decisionId)}`,
  );
  if (!res.data || !canWriteDecisions(org.role)) notFound();
  const d = dict.dash;
  return (
    <>
      <PageTitle title={d.decisions.detail.edit} subtitle={res.data.title} />
      <Panel>
        <DecisionForm
          d={d}
          lang={lang}
          orgId={org.id}
          orgCurrency={org.currency}
          decision={res.data}
        />
      </Panel>
    </>
  );
}

export default function Page({
  params,
}: PageProps<"/[lang]/app/[orgId]/decisions/[decisionId]/edit">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditDecision params={params} />
    </Suspense>
  );
}
