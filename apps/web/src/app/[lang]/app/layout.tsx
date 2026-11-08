import { notFound, redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { DashboardChrome } from "@/components/dashboard/chrome";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getMe } from "@/lib/api";

async function Shell({
  lang,
  children,
}: {
  lang: Locale;
  children: ReactNode;
}) {
  const [me, dict] = await Promise.all([getMe(), getDictionary(lang)]);
  if (!me)
    redirect(`/${lang}/login?next=${encodeURIComponent(`/${lang}/app`)}`);
  return (
    <DashboardChrome d={dict.dash} lang={lang} me={me}>
      {children}
    </DashboardChrome>
  );
}

function ShellSkeleton() {
  return (
    <div className="theme-night flex min-h-dvh">
      <div className="hidden w-64 border-r border-line bg-abyss/60 lg:block" />
      <div className="flex-1 p-8">
        <div className="h-8 w-64 animate-pulse rounded-lg bg-line" />
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-line/60"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function AppLayout({
  children,
  params,
}: LayoutProps<"/[lang]/app">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Shell lang={lang}>{children}</Shell>
    </Suspense>
  );
}
