import { Check, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function AuthLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* Brand panel: desktop only. On tablet/mobile the form takes the full width. */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href={`/${lang}`} className="flex items-center gap-2 font-semibold tracking-tight">
          <ShieldCheck className="size-5 text-blue-500" aria-hidden />
          DecisionGuard
        </Link>
        <div className="max-w-md">
          <h2 className="font-display text-3xl leading-tight">{dict.auth.panelTitle}</h2>
          <p className="mt-4 leading-relaxed text-white/70">{dict.auth.panelBody}</p>
          <ul className="mt-8 space-y-3 text-sm text-white/80">
            {dict.auth.panelPoints.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-blue-500" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/50">{dict.footer.disclaimer}</p>
      </aside>

      <div className="flex flex-col">
        <header className="flex items-center justify-between px-4 py-4 sm:px-8">
          <Link
            href={`/${lang}`}
            className="flex items-center gap-2 font-semibold tracking-tight lg:invisible"
          >
            <ShieldCheck className="size-5 text-blue-500" aria-hidden />
            DecisionGuard
          </Link>
          <LocaleSwitcher current={lang} label={dict.nav.language} />
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-4 sm:items-center sm:px-8">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
