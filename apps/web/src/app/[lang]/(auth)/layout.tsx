import { Home } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Brand } from "@/components/landing/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

/** Shared shell for authentication pages; each page brings its own frame. */
export default async function AuthLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <div className="theme-night relative isolate flex min-h-dvh flex-col overflow-x-clip">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(50%_40%_at_30%_0%,rgba(91,108,255,0.12),transparent_70%)]"
      />
      <header className="px-3 pt-3 sm:px-4">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 rounded-full border border-white/[0.08] bg-night/60 pl-4 pr-2 backdrop-blur-xl sm:pl-5">
          <Brand href={`/${lang}`} label={dict.nav.home} size={28} />
          <div className="flex items-center gap-2">
            <Link
              href={`/${lang}`}
              className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
            >
              <Home className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">{dict.nav.homeLink}</span>
            </Link>
            <LocaleSwitcher current={lang} label={dict.nav.language} />
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
