import { SlidersHorizontal } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageHeader } from "@/components/dashboard/cockpit";
import { ModuleEmpty } from "@/components/dashboard/explainer";
import { PageSkeleton } from "@/components/dashboard/page-title";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { loadOrg } from "@/lib/dash-data";

async function Simulator({
  params,
}: {
  params: Promise<{ lang: string; orgId: string }>;
}) {
  const { lang: raw, orgId } = await params;
  if (!hasLocale(raw)) notFound();
  const lang: Locale = raw;
  const [dict] = await Promise.all([getDictionary(lang), loadOrg(lang, orgId)]);
  const M = dict.dash.simulator;
  return (
    <>
      <PageHeader eyebrow={M.eyebrow} title={M.title} subtitle={M.subtitle} />
      <ModuleEmpty
        icon={SlidersHorizontal}
        title={M.emptyTitle}
        body={M.emptyBody}
        whatTitle={M.whatTitle}
        what={M.what}
      />
    </>
  );
}

export default function Page({
  params,
}: PageProps<"/[lang]/app/[orgId]/simulator">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Simulator params={params} />
    </Suspense>
  );
}
