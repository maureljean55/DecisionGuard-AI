import Link from "next/link";
import { Suspense } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { SystemStatus, SystemStatusFallback } from "@/components/system-status";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

import { Brand } from "./brand";

/** Compact footer: only the links that are not already in the header. */
export function SiteFooter({ dict, lang }: { dict: Dictionary; lang: Locale }) {
  const f = dict.landing.footer;
  const links = [
    { href: `/${lang}/a-propos`, label: f.about },
    { href: `/${lang}/contact`, label: f.contact },
    { href: `/${lang}/confidentialite`, label: f.privacy },
    { href: `/${lang}/conditions`, label: f.terms },
    { href: `/${lang}/mentions-legales`, label: f.legal },
  ];

  return (
    <footer className="border-t border-line bg-night">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <Brand href={`/${lang}`} label={dict.nav.home} size={28} />
        <nav aria-label={f.product}>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="transition-colors hover:text-ink">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
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
