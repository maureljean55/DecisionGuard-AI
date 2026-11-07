/**
 * Marketing sections, shared by the home page (compact versions) and the detail pages.
 */
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Compass,
  GitBranch,
  Landmark,
  Lock,
  MapPin,
  Scale,
  ScanEye,
  ScrollText,
  ServerCog,
  ShieldAlert,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

type L = Dictionary["landing"];

const AGENT_ICONS = [
  Landmark,
  Compass,
  Scale,
  ShieldAlert,
  Users,
  Truck,
  GitBranch,
];
const SECURITY_ICONS = [MapPin, Lock, ScrollText, UserCheck];
const EPISTEMIC_STYLE: Record<string, string> = {
  fact: "border-teal/40 text-teal",
  estimate: "border-iris/50 text-[#9aa6ff]",
  hypothesis: "border-violet/50 text-violet",
  ai: "border-white/20 text-ink/80 border-dashed",
};

export const container = "mx-auto max-w-6xl px-4 sm:px-6 lg:px-8";

// ------------------------------------------------------------------ building blocks

export function PageShell({
  dict,
  lang,
  children,
}: {
  dict: Dictionary;
  lang: Locale;
  children: ReactNode;
}) {
  return (
    <div className="theme-night flex min-h-dvh flex-col overflow-x-clip">
      <SiteHeader dict={dict} lang={lang} />
      <main className="flex-1">{children}</main>
      <SiteFooter dict={dict} lang={lang} />
    </div>
  );
}

export function SectionTitle({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}) {
  return (
    <h2
      id={id}
      className="max-w-2xl font-display text-[2rem] font-medium leading-[1.1] tracking-tight text-ink sm:text-[2.6rem]"
    >
      {children}
    </h2>
  );
}

export function MoreLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-1.5 text-sm font-medium text-teal hover:text-ink"
    >
      {children}
      <ArrowRight
        className="size-4 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

/** Title row of a home section: heading on the left, link to the detail page on the right. */
export function SectionHead({
  id,
  title,
  more,
}: {
  id: string;
  title: string;
  more?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <SectionTitle id={id}>{title}</SectionTitle>
      {more && <MoreLink href={more.href}>{more.label}</MoreLink>}
    </div>
  );
}

export function PageIntro({
  title,
  intro,
}: {
  title: string;
  intro: string;
  /** Kept for call-site compatibility; navigation home is in the header. */
  lang?: Locale;
  back?: string;
}) {
  return (
    <header className="border-b border-line">
      <div className={`${container} py-14 sm:py-16`}>
        <h1 className="max-w-3xl font-display text-[2.5rem] font-medium leading-[1.05] text-ink sm:text-[3.4rem]">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl leading-relaxed text-muted">{intro}</p>
      </div>
    </header>
  );
}

function quote(text: string, lang: Locale) {
  return lang === "fr" ? `« ${text} »` : `“${text}”`;
}

export function RolesCompact({ l, lang }: { l: L; lang: Locale }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {l.roles.list.map((r) => (
        <article
          key={r.role}
          className="rounded-xl border border-line bg-abyss/70 p-5"
        >
          <h3 className="font-display text-xl font-semibold text-ink">
            {r.role}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{r.scope}</p>
          <p className="mt-4 border-t border-line pt-4 font-display text-lg italic leading-snug text-ink/90">
            {quote(r.example, lang)}
          </p>
        </article>
      ))}
    </div>
  );
}

const ROLE_ICONS = [Building2, Landmark, ServerCog];
const ROLE_PHOTOS = ["leader-suit", "finance-tablet", "it-screens"];

export function RolesDetailed({ l, lang }: { l: L; lang: Locale }) {
  const R = l.roles;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-3">
      {R.list.map((r, idx) => {
        const Icon = ROLE_ICONS[idx];
        return (
          <article
            key={r.role}
            className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-abyss transition-colors hover:border-teal/40"
          >
            <CardPhoto
              src={`/roles/${ROLE_PHOTOS[idx]}.webp`}
              sizes="(min-width: 1024px) 370px, 100vw"
            />
            <div className="relative -mt-7 flex flex-1 flex-col px-6 pb-6">
              <span className="flex size-11 items-center justify-center rounded-xl border border-teal/40 bg-night">
                <Icon className="size-5 text-teal" aria-hidden />
              </span>
              <h2 className="mt-5 font-display text-[1.6rem] font-semibold leading-tight text-ink">
                {r.role}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted lg:min-h-[4.6rem]">
                {r.scope}
              </p>
              <p className="mt-5 rounded-lg border border-line bg-night px-4 py-3 font-display text-lg italic leading-snug text-ink/90">
                {quote(r.example, lang)}
              </p>

              {/* Native disclosure: works without JavaScript, keyboard accessible. */}
              <details className="group mt-4">
                <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-teal hover:text-ink [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">{R.readMore}</span>
                  <span className="hidden group-open:inline">{R.readLess}</span>
                  <ChevronDown
                    className="size-4 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="mt-4 space-y-5 border-t border-line pt-5">
                  <div>
                    <h3 className="text-xs font-semibold text-ink">
                      {R.checksLabel}
                    </h3>
                    <ul className="mt-3 space-y-2.5 text-sm text-ink/90">
                      {r.points.map((p) => (
                        <li key={p} className="flex gap-2.5">
                          <Check
                            className="mt-0.5 size-4 shrink-0 text-teal"
                            aria-hidden
                          />
                          <span className="leading-relaxed">{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-ink">
                      {R.decisionsLabel}
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-muted">
                      {r.decisions.map((d) => (
                        <li key={d} className="flex gap-2.5">
                          <span
                            className="mt-2 size-1 shrink-0 rounded-full bg-muted"
                            aria-hidden
                          />
                          <span className="leading-relaxed">{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ agents, method, labels

// One real photo per agent (Unsplash licence), in the order of the agents list.
const AGENT_PHOTOS = [
  "finance-desk",
  "strategy",
  "legal",
  "cyber",
  "people",
  "operations",
  "scenarios",
];

/** Real photo at the top of a card, blended into the night palette. */
export function CardPhoto({
  src,
  sizes = "(min-width: 1024px) 270px, (min-width: 640px) 50vw, 100vw",
}: {
  src: string;
  sizes?: string;
}) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden">
      <Image
        src={src}
        alt=""
        fill
        sizes={sizes}
        className="object-cover brightness-[0.82] saturate-[0.8] transition-transform duration-500 group-hover:scale-[1.04]"
      />
      {/* Blend into the night palette: blue tint, fade to the card colour at the bottom. */}
      <div
        className="absolute inset-0 bg-iris/10 mix-blend-color"
        aria-hidden
      />
      <div
        className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-abyss to-transparent"
        aria-hidden
      />
    </div>
  );
}

export function AgentsGrid({ l }: { l: L }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {l.agents.list.map((a, idx) => {
          const Icon = AGENT_ICONS[idx];
          return (
            <article
              key={a.name}
              id={idx === AGENT_ICONS.length - 1 ? "scenarios" : undefined}
              className="group scroll-mt-24 overflow-hidden rounded-xl border border-line bg-abyss transition-colors hover:border-teal/40 target:border-teal/60"
            >
              <CardPhoto src={`/agents/${AGENT_PHOTOS[idx]}.webp`} />
              <div className="relative -mt-6 px-5 pb-5">
                <span className="flex size-10 items-center justify-center rounded-lg border border-line bg-night">
                  <Icon className="size-[1.1rem] text-muted" aria-hidden />
                </span>
                <h2 className="mt-3 font-display text-xl font-semibold text-ink">
                  {a.name}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {a.body}
                </p>
              </div>
            </article>
          );
        })}
        <article className="group overflow-hidden rounded-xl border border-teal/50 bg-abyss shadow-[inset_3px_0_0_0_var(--teal)]">
          <CardPhoto src="/agents/auditor.webp" />
          <div className="relative -mt-6 px-5 pb-5">
            <span className="flex size-10 items-center justify-center rounded-lg border border-teal/40 bg-night">
              <ScanEye className="size-[1.1rem] text-teal" aria-hidden />
            </span>
            <h2 className="mt-3 font-display text-xl font-semibold text-ink">
              {l.agents.auditName}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink/80">
              {l.agents.auditBody}
            </p>
          </div>
        </article>
      </div>
      <p className="mt-6 text-xs text-muted/70">{l.agents.photoCredits}</p>
    </>
  );
}

export function MethodSteps({ l }: { l: L }) {
  return (
    <ol className="grid gap-x-10 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
      {l.method.steps.map((s, idx) => (
        <li key={s.title} className="border-t border-line pt-5">
          <span className="font-mono text-xs text-teal">{idx + 1}</span>
          <h3 className="mt-2 font-display text-[1.45rem] font-semibold leading-tight text-ink">
            {s.title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function EpistemicList({ l }: { l: L }) {
  return (
    <dl className="divide-y divide-line border-y border-line">
      {l.epistemic.items.map((e) => (
        <div
          key={e.key}
          className="grid gap-3 py-4 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:items-baseline"
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
  );
}

// ------------------------------------------------------------------ security

export function SecurityBand({
  l,
  title,
  more,
}: {
  l: L;
  title: string;
  more: { href: string; label: string };
}) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-teal/50 via-iris/40 to-violet/50 p-px">
      <div className="grid gap-6 rounded-[15px] bg-abyss px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:items-center lg:gap-8 lg:py-7">
        <div>
          <h2
            id="security-title"
            className="font-display text-[1.65rem] font-medium leading-[1.1] text-ink"
          >
            {title}
          </h2>
          <div className="mt-3">
            <MoreLink href={more.href}>{more.label}</MoreLink>
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-y-5 lg:grid-cols-4 lg:gap-y-0 lg:divide-x lg:divide-line">
          {l.security.items.map((s, idx) => {
            const Icon = SECURITY_ICONS[idx];
            return (
              <li
                key={s.title}
                className="flex items-start gap-3 pr-3 lg:px-5 lg:first:pl-0"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-teal/30 bg-teal/10">
                  <Icon className="size-4 text-teal" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug text-ink">
                    {s.title}
                  </p>
                  <p className="mt-1 font-mono text-[0.64rem] leading-snug text-teal/85">
                    {s.tag}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function SecurityCards({ l }: { l: L }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {l.security.items.map((s, idx) => {
        const Icon = SECURITY_ICONS[idx];
        return (
          <li
            key={s.title}
            className="group flex flex-col rounded-xl border border-line bg-abyss/70 p-5 transition-colors hover:border-teal/40"
          >
            <span className="flex size-10 items-center justify-center rounded-lg border border-teal/30 bg-teal/10">
              <Icon className="size-[1.1rem] text-teal" aria-hidden />
            </span>
            <h3 className="mt-4 text-base font-semibold text-ink">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {s.short}
            </p>
            <p className="mt-auto flex items-center gap-2 pt-4 font-mono text-[0.68rem] text-teal/90">
              <span className="size-1.5 rounded-full bg-teal" aria-hidden />
              {s.tag}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export function SecurityDetailed({ l }: { l: L }) {
  return (
    <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
      {l.security.items.map((s, idx) => {
        const Icon = SECURITY_ICONS[idx];
        return (
          <div key={s.title} className="border-t border-line pt-5">
            <Icon className="size-5 text-teal" aria-hidden />
            <h2 className="mt-4 text-lg font-semibold text-ink">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ call to action

const ctaPrimary =
  "group inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-night transition-colors hover:bg-white";

export function CtaBand({ l, lang }: { l: L; lang: Locale }) {
  return (
    <section aria-labelledby="cta-title" className="border-t border-line">
      <div
        className={`${container} flex flex-col gap-8 py-16 lg:flex-row lg:items-center lg:justify-between`}
      >
        <div>
          <h2
            id="cta-title"
            className="font-display text-3xl font-medium leading-tight text-ink sm:text-4xl"
          >
            {l.cta.title}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            {l.cta.body}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-center">
          <Link href={`/${lang}/register`} className={ctaPrimary}>
            {l.cta.button}
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
          <Link
            href={`/${lang}/login`}
            className="text-center text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            {l.cta.login}
          </Link>
        </div>
      </div>
    </section>
  );
}
