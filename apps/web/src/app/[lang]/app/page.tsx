import { Building2, MailWarning, ShieldCheck } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { LogoutButton, ResendVerification } from "@/components/app/session-actions";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/dictionaries";
import { getMe } from "@/lib/api";
import { fmt } from "@/lib/format";

async function Workspace({ dict, lang }: { dict: Dictionary; lang: Locale }) {
  const me = await getMe();
  if (!me) redirect(`/${lang}/login?next=${encodeURIComponent(`/${lang}/app`)}`);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      {!me.user.email_verified && (
        <div
          role="status"
          className="mb-8 flex flex-col gap-3 rounded-lg border border-risk-moderate/40 bg-risk-moderate/10 px-4 py-3 text-ink sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-center gap-2 text-sm">
            <MailWarning className="size-4 shrink-0 text-risk-moderate" aria-hidden />
            {dict.app.verifyBanner}
          </span>
          <ResendVerification label={dict.app.resend} doneLabel={dict.app.resent} />
        </div>
      )}

      <h1 className="font-display text-3xl text-ink">
        {fmt(dict.app.welcome, { name: me.user.full_name })}
      </h1>
      <p className="mt-2 text-muted">{dict.app.subtitle}</p>

      <section className="mt-10">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
          {dict.app.organizations}
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {me.memberships.map((m) => (
            <li key={m.organization.id} className="rounded-lg border border-line bg-surface p-5">
              <Building2 className="size-5 text-blue-500" aria-hidden />
              <p className="mt-3 font-semibold text-ink">{m.organization.name}</p>
              <p className="mt-1 text-sm text-muted">
                {dict.app.role} : {dict.auth.roles[m.role]}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default async function AppHome({ params }: PageProps<"/[lang]/app">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <>
      <header className="border-b border-white/10 bg-navy-950 text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <ShieldCheck className="size-5 text-blue-500" aria-hidden />
            DecisionGuard <span className="text-blue-500">AI</span>
          </span>
          <div className="[&_button]:border-white/20 [&_button]:text-white [&_button:hover]:bg-white/10">
            <LogoutButton label={dict.app.logout} lang={lang} />
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Suspense
          fallback={<div className="mx-auto mt-10 h-32 max-w-4xl animate-pulse rounded-lg bg-line" />}
        >
          <Workspace dict={dict} lang={lang} />
        </Suspense>
      </main>
    </>
  );
}
