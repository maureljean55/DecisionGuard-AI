import { notFound } from "next/navigation";
import { Suspense } from "react";

import { DecisionForm } from "@/components/dashboard/decisions";
import { PageSkeleton, PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/dashboard/ui";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { loadOrg } from "@/lib/dash-data";
import { canWriteDecisions } from "@/lib/permissions";

async function NewDecision({
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
  return (
    <>
      <PageTitle title={d.decisions.new} subtitle={d.decisions.subtitle} />
      <Panel>
        {canWriteDecisions(org.role) ? (
          <DecisionForm
            d={d}
            lang={lang}
            orgId={org.id}
            orgCurrency={org.currency}
          />
        ) : (
          <p className="text-sm text-muted">{d.decisions.readOnly}</p>
        )}
      </Panel>
    </>
  );
}

export default function Page({
  params,
}: PageProps<"/[lang]/app/[orgId]/decisions/new">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewDecision params={params} />
    </Suspense>
  );
}
