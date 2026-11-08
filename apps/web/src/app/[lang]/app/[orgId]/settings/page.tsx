import { notFound } from "next/navigation";
import { Suspense } from "react";

import { OrgSettingsForm } from "@/components/dashboard/forms";
import { PageSkeleton, PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/dashboard/ui";
import { LocalTime } from "@/components/dashboard/local-time";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { loadOrg } from "@/lib/dash-data";
import { fmt } from "@/lib/format";
import { canUpdateOrg } from "@/lib/permissions";

async function Settings({
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
      <PageTitle
        title={d.settings.title}
        subtitle={fmt(d.settings.subtitle, { org: org.name })}
      />
      <Panel>
        <dl className="mb-6 grid gap-4 border-b border-line pb-6 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">{d.settings.slug}</dt>
            <dd className="mt-1 font-mono text-ink">{org.slug}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">{d.settings.created}</dt>
            <dd className="mt-1 text-ink">
              <LocalTime iso={org.created_at} lang={lang} />
            </dd>
          </div>
        </dl>
        <OrgSettingsForm
          d={d}
          lang={lang}
          org={org}
          editable={canUpdateOrg(org.role)}
        />
      </Panel>
    </>
  );
}

export default async function Page({
  params,
}: PageProps<"/[lang]/app/[orgId]/settings">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Settings params={params} />
    </Suspense>
  );
}
