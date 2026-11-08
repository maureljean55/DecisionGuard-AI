import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import {
  PasswordForm,
  ProfileForm,
  SessionsList,
} from "@/components/dashboard/forms";
import { PageSkeleton, PageTitle } from "@/components/dashboard/page-title";
import { Panel } from "@/components/dashboard/ui";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { apiGet, getMe } from "@/lib/api";
import type { SessionInfo } from "@/lib/types";

async function Account({ lang }: { lang: Locale }) {
  const [me, dict, sessions] = await Promise.all([
    getMe(),
    getDictionary(lang),
    apiGet<SessionInfo[]>("/auth/sessions"),
  ]);
  if (!me) redirect(`/${lang}/login`);
  const d = dict.dash;
  return (
    <>
      <PageTitle title={d.account.title} subtitle={d.account.subtitle} />
      <div className="space-y-6">
        <Panel title={d.account.profileTitle}>
          <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">{d.account.email} :</span>
            <span className="text-ink">{me.user.email}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[0.68rem] ${me.user.email_verified ? "bg-teal/15 text-teal" : "bg-risk-moderate/15 text-risk-moderate"}`}
            >
              {me.user.email_verified
                ? d.account.verified
                : d.account.unverified}
            </span>
          </div>
          <ProfileForm
            d={d}
            lang={lang}
            name={me.user.full_name}
            locale={me.user.locale}
          />
        </Panel>
        <Panel title={d.account.passwordTitle}>
          <PasswordForm d={d} auth={dict.auth} />
        </Panel>
        <Panel
          title={d.account.sessionsTitle}
          description={d.account.sessionsBody}
        >
          <SessionsList d={d} lang={lang} sessions={sessions.data ?? []} />
        </Panel>
      </div>
    </>
  );
}

export default async function Page({
  params,
}: PageProps<"/[lang]/app/account">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Account lang={lang} />
    </Suspense>
  );
}
