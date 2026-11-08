import { Radar } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ModuleEmpty } from "@/components/dashboard/explainer";
import { PageSkeleton, PageTitle } from "@/components/dashboard/page-title";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { loadOrg } from "@/lib/dash-data";

async function Module({
  params,
}: {
  params: Promise<{ lang: string; orgId: string }>;
}) {
  const { lang: raw, orgId } = await params;
  if (!hasLocale(raw)) notFound();
  const lang: Locale = raw;
  const [dict] = await Promise.all([getDictionary(lang), loadOrg(lang, orgId)]);
  const M = dict.dash.monitoring;
  return (
    <>
      <PageTitle title={M.title} subtitle={M.subtitle} />
      <ModuleEmpty
        icon={Radar}
        title={M.empty}
        body={M.emptyBody}
        whatTitle={M.whatTitle}
        what={M.what}
      />
    </>
  );
}

export default function Page({
  params,
}: PageProps<"/[lang]/app/[orgId]/monitoring">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Module params={params} />
    </Suspense>
  );
}
