import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { HowItWorks } from "@/components/landing/how-it-works";
import { OwlArrival } from "@/components/landing/owl-arrival";
import { RiskDossier } from "@/components/landing/risk-dossier";
import {
  container,
  CtaBand,
  PageShell,
  SectionHead,
  MoreLink,
  SectionTitle,
  SecurityCards,
} from "@/components/landing/sections";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const L = dict.landing;
  const H = L.home;

  return (
    <PageShell dict={dict} lang={lang}>
      {/* ------------------------------------------------------------ hero */}
      <section className="relative isolate">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_76%_22%,rgba(91,108,255,0.16),transparent_70%)]"
        />
        <div
          className={`${container} grid items-center gap-12 pb-20 pt-12 sm:pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-12 lg:pb-24`}
        >
          <div className="dg-rise">
            <p className="text-sm font-medium text-teal">{L.hero.eyebrow}</p>
            <h1 className="mt-5 font-display text-[2.9rem] font-medium leading-[1] tracking-[-0.015em] text-ink sm:text-6xl lg:text-[4.4rem]">
              {L.hero.titleA}{" "}
              <em className="pr-1 text-teal">{L.hero.titleEm}</em>{" "}
              {L.hero.titleB}
            </h1>
            <p className="mt-6 max-w-lg leading-relaxed text-muted">
              {L.hero.subtitle}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href={`/${lang}/register`}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-night transition-colors hover:bg-white"
              >
                {L.hero.primary}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
              <Link
                href={`/${lang}/methode`}
                className="inline-flex items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-ink transition-colors hover:border-white/35"
              >
                {L.hero.secondary}
              </Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
              {L.hero.trust.map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-3.5 text-teal" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Signature: the owl keeps watch over a real decision file. */}
          <div className="relative mx-auto w-full max-w-xl lg:max-w-none">
            <div className="relative mx-auto -mb-12 w-[70%] max-w-[400px] sm:-mb-20">
              <OwlArrival sizes="(min-width: 1024px) 400px, 70vw" />
            </div>
            <div className="relative">
              <RiskDossier d={L.dossier} />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ how it works */}
      <section
        aria-labelledby="how-title"
        className="border-t border-line bg-abyss/40"
      >
        <div className={`${container} py-16 lg:py-20`}>
          <SectionHead
            id="how-title"
            title={L.how.title}
            more={{ href: `/${lang}/methode`, label: L.how.more }}
          />
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
            {L.how.intro}
          </p>
          <div className="mt-10">
            <HowItWorks h={L.how} />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ security */}
      <section
        aria-labelledby="security-title"
        className="border-t border-line"
      >
        <div
          className={`${container} grid gap-10 py-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14 lg:py-20`}
        >
          <div className="lg:pt-2">
            <SectionTitle id="security-title">{H.securityTitle}</SectionTitle>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
              {H.securityIntro}
            </p>
            <div className="mt-6">
              <MoreLink href={`/${lang}/securite`}>{H.securityMore}</MoreLink>
            </div>
          </div>
          <SecurityCards l={L} />
        </div>
      </section>

      <CtaBand l={L} lang={lang} />
    </PageShell>
  );
}
