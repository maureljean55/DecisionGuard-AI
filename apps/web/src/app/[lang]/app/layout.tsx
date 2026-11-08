import { notFound, redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { DashboardChrome } from "@/components/dashboard/chrome";
import { hasLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { apiGet, getMe } from "@/lib/api";
import type { EngineStatus } from "@/lib/types";

async function Shell({
  lang,
  children,
}: {
  lang: Locale;
  children: ReactNode;
}) {
  const [me, dict, engine] = await Promise.all([
    getMe(),
    getDictionary(lang),
    apiGet<EngineStatus>("/engine"),
  ]);
  if (!me)
    redirect(`/${lang}/login?next=${encodeURIComponent(`/${lang}/app`)}`);
  return (
    <DashboardChrome
      d={dict.dash}
      lang={lang}
      me={me}
      engine={engine.data}
    >
      {children}
    </DashboardChrome>
  );
}

function ShellSkeleton() {
  return (
    <div className="theme-night theme-cockpit flex min-h-dvh">
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
