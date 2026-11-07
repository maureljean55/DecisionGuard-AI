import Link from "next/link";
import { Suspense } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { SystemStatus, SystemStatusFallback } from "@/components/system-status";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

import { Brand } from "./brand";

export function SiteFooter({ dict, lang }: { dict: Dictionary; lang: Locale }) {
  const f = dict.landing.footer;
  const linkClass = "text-muted transition-colors hover:text-ink";

  return (
    <footer className="relative border-t border-line bg-night">
      <div className="wing-rule absolute inset-x-0 top-0 opacity-60" aria-hidden />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div className="max-w-sm">
          <Brand href={`/${lang}`} label={dict.nav.home} size={36} />
          <p className="mt-5 text-sm leading-relaxed text-muted">{f.tagline}</p>
        </div>

        <nav aria-label={f.product} className="text-sm">
          <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted/70">
            {f.product}
          </h2>
          <ul className="mt-4 space-y-3">
            <li><a href="#methode" className={linkClass}>{dict.nav.method}</a></li>
            <li><a href="#agents" className={linkClass}>{dict.nav.agents}</a></li>
            <li><a href="#securite" className={linkClass}>{dict.nav.security}</a></li>
          </ul>
        </nav>

        <nav aria-label={f.account} className="text-sm">
          <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.2em] text-muted/70">
            {f.account}
          </h2>
          <ul className="mt-4 space-y-3">
            <li><Link href={`/${lang}/login`} className={linkClass}>{f.login}</Link></li>
            <li><Link href={`/${lang}/register`} className={linkClass}>{f.register}</Link></li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 text-xs text-muted sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <p className="max-w-2xl leading-relaxed">{dict.footer.disclaimer}</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Suspense fallback={<SystemStatusFallback />}>
              <SystemStatus dict={dict.status} />
            </Suspense>
            <LocaleSwitcher current={lang} label={dict.nav.language} />
            <span>© 2026 DecisionGuard AI. {f.rights}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
