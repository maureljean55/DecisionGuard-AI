import { Check } from "lucide-react";
import Image from "next/image";
import { notFound } from "next/navigation";

import { Brand } from "@/components/landing/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function AuthLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <div className="theme-night grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Brand panel (desktop): the owl keeps watch, with the promise of the product. */}
      <aside className="relative isolate hidden overflow-hidden border-r border-line bg-abyss p-12 lg:flex lg:flex-col">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(60%_45%_at_50%_30%,rgba(91,108,255,0.22),transparent_70%),radial-gradient(40%_35%_at_80%_85%,rgba(53,208,214,0.08),transparent_70%)]"
        />
        <Brand href={`/${lang}`} label={dict.nav.home} size={32} />

        <div className="flex flex-1 flex-col justify-center">
          <Image
            src="/brand/owl-emblem-480.png"
            alt=""
            width={480}
            height={324}
            priority
            className="mx-auto h-auto w-[78%] max-w-[360px] drop-shadow-[0_24px_60px_rgba(91,108,255,0.35)]"
          />
          <div className="mx-auto mt-10 max-w-md">
            <h2 className="font-display text-[2rem] font-medium leading-tight text-ink">
              {dict.auth.panelTitle}
            </h2>
            <p className="mt-3 leading-relaxed text-muted">{dict.auth.panelBody}</p>
            <ul className="mt-7 space-y-3 text-sm text-ink/85">
              {dict.auth.panelPoints.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-teal/40 bg-teal/10">
                    <Check className="size-3 text-teal" aria-hidden />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* Form side */}
      <div className="relative isolate flex flex-col">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(50%_40%_at_50%_0%,rgba(91,108,255,0.10),transparent_70%)] lg:hidden"
        />
        <header className="flex items-center justify-between px-4 py-4 sm:px-8 lg:justify-end">
          <span className="lg:hidden">
            <Brand href={`/${lang}`} label={dict.nav.home} size={28} />
          </span>
          <LocaleSwitcher current={lang} label={dict.nav.language} />
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-6 sm:items-center sm:px-8">
          <div className="w-full max-w-md rounded-3xl border border-line bg-abyss/70 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)] sm:p-9">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
