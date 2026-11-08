import { Building2 } from "lucide-react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { CreateOrgForm } from "@/components/dashboard/forms";
import { PageSkeleton } from "@/components/dashboard/page-title";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getMe } from "@/lib/api";

/** Entry point: opens the last organisation visited, or offers to create one. */
async function Entry({ lang }: { lang: Locale }) {
  const [me, dict, jar] = await Promise.all([
    getMe(),
    getDictionary(lang),
    cookies(),
  ]);
  if (!me) redirect(`/${lang}/login`);
  if (me.memberships.length) {
    const last = jar.get("dg_org")?.value;
    const target =
      me.memberships.find((m) => m.organization.id === last) ??
      me.memberships[0];
    redirect(`/${lang}/app/${target.organization.id}`);
  }
  const d = dict.dash;
  return (
    <div className="mx-auto max-w-xl">
      <span className="flex size-12 items-center justify-center rounded-xl border border-teal/30 bg-teal/10">
        <Building2 className="size-5 text-teal" aria-hidden />
      </span>
      <h1 className="mt-5 font-display text-[2rem] font-medium text-ink">
        {d.noOrg.title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{d.noOrg.body}</p>
      <div className="mt-8 rounded-2xl border border-line bg-abyss/70 p-6">
        <CreateOrgForm d={d} lang={lang} />
      </div>
    </div>
  );
}

export default async function Page({ params }: PageProps<"/[lang]/app">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Entry lang={lang} />
    </Suspense>
  );
}
