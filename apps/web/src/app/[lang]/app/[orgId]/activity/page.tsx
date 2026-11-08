import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActivityList } from "@/components/dashboard/forms";
import { PageSkeleton, PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/dashboard/ui";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { apiGet } from "@/lib/api";
import { loadOrg } from "@/lib/dash-data";
import { canReadAudit } from "@/lib/permissions";
import type { AuditPage } from "@/lib/types";

async function Activity({
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
  const allowed = canReadAudit(org.role);
  const page = allowed
    ? await apiGet<AuditPage>(`/orgs/${org.id}/audit-logs?limit=30`)
    : null;
  return (
    <>
      <PageTitle title={d.activity.title} subtitle={d.activity.subtitle} />
      <Panel>
        {allowed && page?.data ? (
          <ActivityList d={d} lang={lang} orgId={org.id} initial={page.data} />
        ) : (
          <p className="text-sm text-muted">{d.activity.forbidden}</p>
        )}
      </Panel>
    </>
  );
}

export default async function Page({
  params,
}: PageProps<"/[lang]/app/[orgId]/activity">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Activity params={params} />
    </Suspense>
  );
}
