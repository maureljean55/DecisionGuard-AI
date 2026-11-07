import Link from "next/link";
import { Suspense } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { SystemStatus, SystemStatusFallback } from "@/components/system-status";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

import { Brand } from "./brand";

/** Footer: brand and tagline, then four link columns (only pages that exist). */
export function SiteFooter({ dict, lang }: { dict: Dictionary; lang: Locale }) {
  const f = dict.landing.footer;
  const columns = [
    {
      title: f.colProduct,
      links: [
        { href: `/${lang}/agents`, label: f.agents },
        { href: `/${lang}/methode`, label: f.riskAnalysis },
        { href: `/${lang}/agents#scenarios`, label: f.scenarios },
      ],
    },
    {
      title: f.colCompany,
      links: [
        { href: `/${lang}/a-propos`, label: f.about },
        { href: `/${lang}/contact`, label: f.contact },
      ],
    },
    {
      title: f.colResources,
      links: [
        { href: `/${lang}/faq`, label: f.faq },
        { href: `/${lang}/securite`, label: f.security },
      ],
    },
    {
      title: f.colLegal,
      links: [
        { href: `/${lang}/confidentialite`, label: f.privacy },
        { href: `/${lang}/conditions`, label: f.terms },
        { href: `/${lang}/mentions-legales`, label: f.legal },
      ],
    },
  ];

  return (
    <footer className="border-t border-line bg-night">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.35fr)_repeat(4,minmax(0,1fr))] lg:gap-8 lg:px-8">
        <div className="max-w-xs">
          <Brand href={`/${lang}`} label={dict.nav.home} size={30} />
          <p className="mt-4 text-sm leading-relaxed text-muted">{f.tagline}</p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:contents">
          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-muted/80">
                {col.title}
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-ink/85 transition-colors hover:text-teal"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 text-xs text-muted sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p className="max-w-xl">{dict.footer.disclaimer}</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Suspense fallback={<SystemStatusFallback />}>
              <SystemStatus dict={dict.status} />
            </Suspense>
            <LocaleSwitcher current={lang} label={dict.nav.language} />
            <span>© 2026 DecisionGuard</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
