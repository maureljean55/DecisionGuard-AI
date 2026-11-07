import { Menu, X } from "lucide-react";
import Link from "next/link";

import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

import { Brand } from "./brand";

export function SiteHeader({ dict, lang }: { dict: Dictionary; lang: Locale }) {
  const links = [
    { href: `/${lang}/solutions`, label: dict.nav.roles },
    { href: `/${lang}/methode`, label: dict.nav.method },
    { href: `/${lang}/agents`, label: dict.nav.agents },
    { href: `/${lang}/securite`, label: dict.nav.security },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-night/75 backdrop-blur-xl">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
        <Brand href={`/${lang}`} label={dict.nav.home} />

        <nav aria-label={dict.nav.menu} className="hidden items-center gap-8 text-sm text-muted lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition-colors hover:text-ink">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <LocaleSwitcher current={lang} label={dict.nav.language} />
          <Link href={`/${lang}/login`} className="text-sm text-muted transition-colors hover:text-ink">
            {dict.nav.login}
          </Link>
          <Link
            href={`/${lang}/register`}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-night transition-colors hover:bg-white"
          >
            {dict.nav.cta}
          </Link>
        </div>

        {/* Mobile & tablet: native disclosure, works without JavaScript. */}
        <details className="group relative lg:hidden">
          <summary
            className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-line text-ink [&::-webkit-details-marker]:hidden"
            aria-label={dict.nav.menu}
          >
            <Menu className="size-5 group-open:hidden" aria-hidden />
            <X className="hidden size-5 group-open:block" aria-hidden />
          </summary>
          <div className="absolute right-0 top-14 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-line bg-abyss p-5 shadow-2xl shadow-black/50">
            <nav aria-label={dict.nav.menu} className="flex flex-col gap-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-lg px-3 py-3 text-ink transition-colors hover:bg-white/5"
                >
                  {l.label}
                </Link>
              ))}
              <Link
                href={`/${lang}/login`}
                className="rounded-lg px-3 py-3 text-ink transition-colors hover:bg-white/5"
              >
                {dict.nav.login}
              </Link>
            </nav>
            <Link
              href={`/${lang}/register`}
              className="mt-4 block rounded-full bg-ink px-5 py-3 text-center text-sm font-semibold text-night"
            >
              {dict.nav.cta}
            </Link>
            <div className="mt-4 flex justify-center">
              <LocaleSwitcher current={lang} label={dict.nav.language} />
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
