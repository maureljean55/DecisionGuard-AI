import {
  ArrowRight,
  Compass,
  GitBranch,
  Landmark,
  Lock,
  MapPin,
  Scale,
  ScanEye,
  ScrollText,
  ShieldAlert,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { RiskDossier } from "@/components/landing/risk-dossier";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

const AGENT_ICONS = [Landmark, Compass, Scale, ShieldAlert, Users, Truck, GitBranch];
const SECURITY_ICONS = [MapPin, Lock, ScrollText, UserCheck];
const EPISTEMIC_STYLE: Record<string, string> = {
  fact: "border-teal/40 text-teal",
  estimate: "border-iris/50 text-[#9aa6ff]",
  hypothesis: "border-violet/50 text-violet",
  ai: "border-white/20 text-ink/80 border-dashed",
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[0.7rem] uppercase tracking-[0.22em] text-teal">{children}</p>
  );
}

function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="mt-4 max-w-3xl font-display text-[2.4rem] font-medium leading-[1.05] tracking-tight text-ink sm:text-5xl"
    >
      {children}
    </h2>
  );
}

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const L = dict.landing;

  return (
    <div className="theme-night flex min-h-dvh flex-col overflow-x-clip">
      <SiteHeader dict={dict} lang={lang} />

      <main className="flex-1">
        {/* ------------------------------------------------------------ hero */}
        <section className="relative isolate">
          {/* Night sky: the emblem's own light, nothing else. */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_75%_20%,rgba(91,108,255,0.22),transparent_70%),radial-gradient(40%_40%_at_95%_60%,rgba(164,107,255,0.14),transparent_70%),radial-gradient(35%_35%_at_55%_45%,rgba(53,208,214,0.10),transparent_70%)]"
          />
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-24 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10 lg:px-8 lg:pb-32">
            <div className="dg-rise">
              <Eyebrow>{L.hero.eyebrow}</Eyebrow>
              <h1 className="mt-6 font-display text-[3.1rem] font-medium leading-[0.98] tracking-[-0.015em] text-ink sm:text-7xl lg:text-[5.4rem]">
                {L.hero.titleA}{" "}
                <em className="wing-text pr-1 font-semibold">{L.hero.titleEm}</em> {L.hero.titleB}
              </h1>
              <p className="mt-8 max-w-xl text-[1.05rem] leading-relaxed text-muted">
                {L.hero.subtitle}
              </p>
              <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href={`/${lang}/register`}
                  className="group inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-night transition-colors hover:bg-white"
                >
                  {L.hero.primary}
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
                <a
                  href="#methode"
                  className="inline-flex items-center justify-center rounded-full border border-white/15 px-7 py-3.5 text-sm font-medium text-ink transition-colors hover:border-white/35"
                >
                  {L.hero.secondary}
                </a>
              </div>
              <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
                {L.hero.trust.map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <span className="size-1 rounded-full bg-teal" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Signature: the owl keeps watch over a real decision file. */}
            <div className="relative mx-auto w-full max-w-2xl lg:max-w-none">
              <div className="relative mx-auto -mb-16 w-[78%] max-w-[480px] sm:-mb-24">
                <Image
                  src="/brand/owl-emblem.png"
                  alt=""
                  width={1063}
                  height={718}
                  priority
                  sizes="(min-width: 1024px) 480px, 78vw"
                  className="h-auto w-full drop-shadow-[0_20px_60px_rgba(91,108,255,0.35)]"
                />
              </div>
              <div className="relative">
                <RiskDossier d={L.dossier} />
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ questions */}
        <section aria-labelledby="questions-title" className="border-t border-line">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:px-8 lg:py-32">
            <div>
              <Eyebrow>{L.questions.eyebrow}</Eyebrow>
              <SectionTitle id="questions-title">{L.questions.title}</SectionTitle>
              <p className="mt-6 max-w-sm leading-relaxed text-muted">{L.questions.note}</p>
            </div>
            <ul className="grid gap-x-10 sm:grid-cols-2">
              {L.questions.items.map((q) => (
                <li
                  key={q}
                  className="border-b border-line py-6 font-display text-[1.65rem] italic leading-snug text-ink/90 sm:text-3xl"
                >
                  {q}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------------------ agents */}
        <section id="agents" aria-labelledby="agents-title" className="scroll-mt-20 bg-abyss/60">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <Eyebrow>{L.agents.eyebrow}</Eyebrow>
                <SectionTitle id="agents-title">{L.agents.title}</SectionTitle>
              </div>
              <p className="max-w-sm leading-relaxed text-muted">{L.agents.intro}</p>
            </div>

            <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {L.agents.list.map((a, idx) => {
                const Icon = AGENT_ICONS[idx];
                return (
                  <article key={a.name} className="bg-night p-7 transition-colors hover:bg-abyss">
                    <Icon className="size-5 text-muted" aria-hidden />
                    <h3 className="mt-6 font-display text-2xl font-semibold text-ink">{a.name}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted">{a.body}</p>
                  </article>
                );
              })}
              {/* The eighth perspective is different in kind: it can overrule the others. */}
              <article className="relative overflow-hidden bg-night p-7">
                <div
                  aria-hidden
                  className="absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgba(164,107,255,0.22),transparent_60%),radial-gradient(100%_80%_at_0%_100%,rgba(53,208,214,0.16),transparent_60%)]"
                />
                <div className="relative">
                  <ScanEye className="size-5 text-teal" aria-hidden />
                  <h3 className="wing-text mt-6 font-display text-2xl font-semibold">
                    {L.agents.auditName}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink/80">{L.agents.auditBody}</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ method (a true sequence) */}
        <section id="methode" aria-labelledby="method-title" className="scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
            <Eyebrow>{L.method.eyebrow}</Eyebrow>
            <SectionTitle id="method-title">{L.method.title}</SectionTitle>
            <ol className="mt-16 grid gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
              {L.method.steps.map((s, idx) => (
                <li key={s.title} className="relative border-t border-line pt-6">
                  <span
                    className={`absolute -top-px left-0 h-px w-16 ${idx === L.method.steps.length - 1 ? "bg-gradient-to-r from-teal via-iris to-violet" : "bg-ink/40"}`}
                    aria-hidden
                  />
                  <span className="font-mono text-xs text-muted">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-3 font-display text-[1.7rem] font-semibold leading-tight text-ink">
                    {s.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------------ facts ≠ assumptions */}
        <section aria-labelledby="epistemic-title" className="border-y border-line bg-abyss/60">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
            <div>
              <Eyebrow>{L.epistemic.eyebrow}</Eyebrow>
              <SectionTitle id="epistemic-title">{L.epistemic.title}</SectionTitle>
              <p className="mt-6 max-w-md leading-relaxed text-muted">{L.epistemic.intro}</p>
            </div>
            <dl className="space-y-4">
              {L.epistemic.items.map((e) => (
                <div
                  key={e.key}
                  className="grid gap-3 rounded-2xl border border-line bg-night p-5 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:items-baseline"
                >
                  <dt>
                    <span
                      className={`inline-block rounded-full border px-3 py-1 font-mono text-[0.68rem] uppercase tracking-wider ${EPISTEMIC_STYLE[e.key]}`}
                    >
                      {e.name}
                    </span>
                  </dt>
                  <dd className="text-sm leading-relaxed text-muted">{e.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* ------------------------------------------------------------ security */}
        <section id="securite" aria-labelledby="security-title" className="scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
            <Eyebrow>{L.security.eyebrow}</Eyebrow>
            <SectionTitle id="security-title">{L.security.title}</SectionTitle>
            <div className="mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {L.security.items.map((s, idx) => {
                const Icon = SECURITY_ICONS[idx];
                return (
                  <div key={s.title}>
                    <span className="flex size-11 items-center justify-center rounded-full border border-line">
                      <Icon className="size-5 text-teal" aria-hidden />
                    </span>
                    <h3 className="mt-5 text-base font-semibold text-ink">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ final call */}
        <section aria-labelledby="cta-title" className="px-4 pb-24 sm:px-6 lg:px-8 lg:pb-32">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[28px] border border-line bg-abyss px-6 py-16 text-center sm:px-12 sm:py-24">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(50%_70%_at_50%_0%,rgba(91,108,255,0.28),transparent_70%)]"
            />
            <div className="wing-rule absolute inset-x-0 top-0" aria-hidden />
            <div className="relative">
              <h2
                id="cta-title"
                className="mx-auto max-w-3xl font-display text-4xl font-medium leading-[1.05] text-ink sm:text-6xl"
              >
                {L.cta.title}
              </h2>
              <p className="mx-auto mt-6 max-w-xl leading-relaxed text-muted">{L.cta.body}</p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link
                  href={`/${lang}/register`}
                  className="group inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-night transition-colors hover:bg-white"
                >
                  {L.cta.button}
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
                <Link
                  href={`/${lang}/login`}
                  className="text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
                >
                  {L.cta.login}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter dict={dict} lang={lang} />
    </div>
  );
}
