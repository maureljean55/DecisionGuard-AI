import { CheckCircle2, Scale, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { SystemStatus, SystemStatusFallback } from "@/components/system-status";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const pillars = [
    { icon: ShieldCheck, ...dict.pillars.verified },
    { icon: Scale, ...dict.pillars.reproducible },
    { icon: CheckCircle2, ...dict.pillars.transparent },
  ];

  return (
    <>
      <header className="border-b border-white/10 bg-navy-950 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="flex items-center gap-2 font-semibold tracking-tight">
            <ShieldCheck className="size-5 text-blue-500" aria-hidden />
            DecisionGuard <span className="text-blue-500">AI</span>
          </span>
          <div className="flex items-center gap-6 text-sm text-white/70">
            <a href="#features" className="hidden hover:text-white sm:inline">
              {dict.nav.features}
            </a>
            <LocaleSwitcher current={lang} label={dict.nav.language} />
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-gradient-to-b from-navy-950 to-navy-900 text-white">
          <div className="mx-auto max-w-6xl px-4 pb-24 pt-20 sm:px-6">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-500">
              {dict.hero.eyebrow}
            </p>
            <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight sm:text-5xl">
              {dict.hero.title}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
              {dict.hero.subtitle}
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <a
                href="#features"
                className="rounded-md bg-blue-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-500/90"
              >
                {dict.hero.cta}
              </a>
              <a
                href="#features"
                className="rounded-md border border-white/20 px-5 py-2.5 text-sm font-medium text-white/90 hover:bg-white/5"
              >
                {dict.hero.secondary}
              </a>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-3 sm:px-6">
          {pillars.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-lg border border-line bg-surface p-6">
              <Icon className="size-5 text-blue-500" aria-hidden />
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="max-w-2xl">{dict.footer.disclaimer}</p>
          <Suspense fallback={<SystemStatusFallback />}>
            <SystemStatus dict={dict.status} />
          </Suspense>
        </div>
      </footer>
    </>
  );
}
