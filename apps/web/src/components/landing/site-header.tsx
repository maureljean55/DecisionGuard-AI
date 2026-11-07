import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";

import { LocaleSwitcher } from "@/components/locale-switcher";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

import { Brand } from "./brand";
import { HeaderShell } from "./header-shell";
import { NavLinks } from "./nav-links";

export function SiteHeader({ dict, lang }: { dict: Dictionary; lang: Locale }) {
  const links = [
    { href: `/${lang}`, label: dict.nav.homeLink },
    { href: `/${lang}/solutions`, label: dict.nav.roles },
    { href: `/${lang}/agents`, label: dict.nav.agents },
  ];

  return (
    <HeaderShell>
      <Brand href={`/${lang}`} label={dict.nav.home} size={30} />

      {/* Desktop navigation: segmented pill, the active page is highlighted. */}
      <nav
        aria-label={dict.nav.menu}
        className="hidden items-center gap-0.5 rounded-full border border-white/[0.06] bg-white/[0.03] p-1 text-sm lg:flex"
      >
        <NavLinks links={links} home={`/${lang}`} variant="desktop" />
      </nav>

      <div className="hidden items-center gap-2 lg:flex">
        <LocaleSwitcher current={lang} label={dict.nav.language} />
        <Link
          href={`/${lang}/login`}
          className="rounded-full px-3.5 py-2 text-sm text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
        >
          {dict.nav.login}
        </Link>
        <Link
          href={`/${lang}/register`}
          className="group inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-night transition-colors hover:bg-white"
        >
          {dict.nav.cta}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>

      {/* Mobile & tablet: native disclosure, works without JavaScript. */}
      <details className="group relative lg:hidden">
        <summary
          className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-ink transition-colors hover:bg-white/[0.08] [&::-webkit-details-marker]:hidden"
          aria-label={dict.nav.menu}
        >
          <Menu className="size-[1.1rem] group-open:hidden" aria-hidden />
          <X className="hidden size-[1.1rem] group-open:block" aria-hidden />
        </summary>
        <div className="absolute right-0 top-14 w-[min(21rem,calc(100vw-1.5rem))] rounded-3xl border border-white/10 bg-abyss p-3 shadow-2xl shadow-black/60">
          <nav aria-label={dict.nav.menu} className="flex flex-col gap-0.5">
            <NavLinks links={links} home={`/${lang}`} variant="mobile" />
            <Link
              href={`/${lang}/login`}
              className="rounded-xl px-3 py-3 text-ink/85 transition-colors hover:bg-white/5"
            >
              {dict.nav.login}
            </Link>
          </nav>
          <Link
            href={`/${lang}/register`}
            className="mt-2 flex items-center justify-center gap-1.5 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-night"
          >
            {dict.nav.cta}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
          <div className="mt-3 flex justify-center pb-1">
            <LocaleSwitcher current={lang} label={dict.nav.language} />
          </div>
        </div>
      </details>
    </HeaderShell>
  );
}
