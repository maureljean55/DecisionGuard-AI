import {
  ArrowRight,
  Check,
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

import { AnalysisFlow } from "@/components/landing/analysis-flow";
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

function SectionTitle({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <h2
      id={id}
      className="max-w-3xl font-display text-[2.3rem] font-medium leading-[1.08] tracking-tight text-ink sm:text-[3.2rem]"
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
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[radial-gradient(55%_45%_at_76%_22%,rgba(91,108,255,0.16),transparent_70%)]"
          />
          <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 pb-24 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10 lg:px-8 lg:pb-32">
            <div className="dg-rise">
              <p className="text-sm font-medium text-teal">{L.hero.eyebrow}</p>
              <h1 className="mt-5 font-display text-[3.1rem] font-medium leading-[0.98] tracking-[-0.015em] text-ink sm:text-7xl lg:text-[5.2rem]">
                {L.hero.titleA} <em className="pr-1 text-teal">{L.hero.titleEm}</em>{" "}
                {L.hero.titleB}
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
                    <Check className="size-3.5 text-teal" aria-hidden />
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
                  className="h-auto w-full drop-shadow-[0_20px_60px_rgba(91,108,255,0.3)]"
                />
              </div>
              <div className="relative">
                <RiskDossier d={L.dossier} />
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ by role */}
        <section
          id="pour-qui"
          aria-labelledby="roles-title"
          className="scroll-mt-20 border-t border-line"
        >
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-28">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
              <SectionTitle id="roles-title">{L.roles.title}</SectionTitle>
              <p className="max-w-md leading-relaxed text-muted">{L.roles.intro}</p>
            </div>
            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {L.roles.list.map((r) => (
                <article
                  key={r.role}
                  className="flex flex-col rounded-2xl border border-line bg-abyss/70 p-7"
                >
                  <h3 className="font-display text-[1.75rem] font-semibold leading-tight text-ink">
                    {r.role}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{r.scope}</p>
                  <ul className="mt-6 space-y-3 text-sm text-ink/90">
                    {r.points.map((p) => (
                      <li key={p} className="flex gap-3">
                        <Check className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
                        <span className="leading-relaxed">{p}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-7">
                    <div className="border-t border-line pt-5">
                      <p className="text-xs text-muted">{L.roles.exampleLabel}</p>
                      <p className="mt-1.5 font-display text-xl italic text-ink">
                        {lang === "fr" ? `«\u00a0${r.example}\u00a0»` : `“${r.example}”`}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ agents */}
        <section id="agents" aria-labelledby="agents-title" className="scroll-mt-20 bg-abyss/60">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-28">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
              <SectionTitle id="agents-title">{L.agents.title}</SectionTitle>
              <p className="max-w-md leading-relaxed text-muted">{L.agents.intro}</p>
            </div>

            <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
              {L.agents.list.map((a, idx) => {
                const Icon = AGENT_ICONS[idx];
                return (
                  <article key={a.name} className="bg-night p-7">
                    <Icon className="size-5 text-muted" aria-hidden />
                    <h3 className="mt-5 font-display text-2xl font-semibold text-ink">{a.name}</h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted">{a.body}</p>
                  </article>
                );
              })}
              {/* The eighth agent is different in kind: it can send the others' work back. */}
              <article className="border-l-[3px] border-teal bg-night p-7">
                <ScanEye className="size-5 text-teal" aria-hidden />
                <h3 className="mt-5 font-display text-2xl font-semibold text-ink">
                  {L.agents.auditName}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-ink/80">{L.agents.auditBody}</p>
              </article>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ method (a true sequence) */}
        <section id="methode" aria-labelledby="method-title" className="scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-28">
            <SectionTitle id="method-title">{L.method.title}</SectionTitle>
            <ol className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
              {L.method.steps.map((s, idx) => (
                <li key={s.title} className="border-t border-line pt-6">
                  <span className="font-mono text-xs text-teal">{idx + 1}</span>
                  <h3 className="mt-2 font-display text-[1.65rem] font-semibold leading-tight text-ink">
                    {s.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------------ how a decision flows */}
        <section aria-labelledby="flow-title" className="border-t border-line bg-abyss/60">
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-28">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-end">
              <SectionTitle id="flow-title">{L.flow.title}</SectionTitle>
              <p className="max-w-md leading-relaxed text-muted">{L.flow.intro}</p>
            </div>
            <div className="mt-14 rounded-2xl border border-line bg-night px-4 py-8 sm:px-8 lg:px-10 lg:py-12">
              <AnalysisFlow f={L.flow} />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ facts ≠ assumptions */}
        <section aria-labelledby="epistemic-title" className="border-t border-line">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-28">
            <div>
              <SectionTitle id="epistemic-title">{L.epistemic.title}</SectionTitle>
              <p className="mt-6 max-w-md leading-relaxed text-muted">{L.epistemic.intro}</p>
            </div>
            <dl className="divide-y divide-line border-y border-line">
              {L.epistemic.items.map((e) => (
                <div
                  key={e.key}
                  className="grid gap-3 py-5 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:items-baseline"
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
        <section
          id="securite"
          aria-labelledby="security-title"
          className="scroll-mt-20 border-t border-line bg-abyss/60"
        >
          <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-28">
            <SectionTitle id="security-title">{L.security.title}</SectionTitle>
            <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              {L.security.items.map((s, idx) => {
                const Icon = SECURITY_ICONS[idx];
                return (
                  <div key={s.title}>
                    <Icon className="size-5 text-teal" aria-hidden />
                    <h3 className="mt-4 text-base font-semibold text-ink">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ call to action */}
        <section aria-labelledby="cta-title" className="border-t border-line">
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:px-8 lg:py-28">
            <div>
              <h2
                id="cta-title"
                className="font-display text-4xl font-medium leading-[1.05] text-ink sm:text-[3.4rem]"
              >
                {L.cta.title}
              </h2>
              <p className="mt-6 max-w-xl leading-relaxed text-muted">{L.cta.body}</p>
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:justify-end">
              <Link
                href={`/${lang}/register`}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold text-night transition-colors hover:bg-white"
              >
                {L.cta.button}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
              <Link
                href={`/${lang}/login`}
                className="text-center text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
              >
                {L.cta.login}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter dict={dict} lang={lang} />
    </div>
  );
}
