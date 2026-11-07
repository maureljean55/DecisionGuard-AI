import {
  Presentation,
  Scale,
  Truck,
  Users,
  Building,
  Building2,
  HelpCircle,
  Rocket,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  container,
  PageShell,
  RolesDetailed,
  SectionTitle,
} from "@/components/landing/sections";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/solutions">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.pages.solutions.meta,
    description: dict.solutionsPage.intro,
  };
}

type Level = "low" | "moderate" | "high" | "critical";
// Same thresholds as the risk engine.
const levelOf = (s: number): Level =>
  s >= 17 ? "critical" : s >= 10 ? "high" : s >= 5 ? "moderate" : "low";
const LEVEL_STYLE: Record<Level, string> = {
  low: "border-risk-low/40 text-risk-low",
  moderate: "border-risk-moderate/40 text-risk-moderate",
  high: "border-risk-high/40 text-risk-high",
  critical: "border-risk-critical/50 text-risk-critical",
};
const SIZE_ICONS = [Rocket, Building, Building2];
const TEAM_ICONS = [Users, Scale, Truck, Presentation];

export default async function Page({ params }: PageProps<"/[lang]/solutions">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const L = dict.landing;
  const S = dict.solutionsPage;

  return (
    <PageShell dict={dict} lang={lang}>
      {/* ------------------------------------------------------------ intro */}
      <header className="relative isolate border-b border-line">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(45%_60%_at_85%_10%,rgba(91,108,255,0.14),transparent_70%)]"
        />
        <div className={`${container} py-14 sm:py-16`}>
          <p className="text-sm font-medium text-teal">{S.eyebrow}</p>
          <h1 className="mt-4 max-w-3xl font-display text-[2.5rem] font-medium leading-[1.05] text-ink sm:text-[3.4rem]">
            {S.title}
          </h1>
          <p className="mt-5 max-w-2xl leading-relaxed text-muted">{S.intro}</p>
        </div>
      </header>

      {/* ------------------------------------------------------------ the three role cards (kept) */}
      <section className={`${container} py-14`}>
        <RolesDetailed l={L} lang={lang} />
        <p className="mt-6 text-xs text-muted/70">{S.photoCredits}</p>
      </section>

      {/* ------------------------------------------------------------ one decision, three readings */}
      <section
        aria-labelledby="lens-title"
        className="border-t border-line bg-abyss/40"
      >
        <div className={`${container} py-14 lg:py-16`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <SectionTitle id="lens-title">{S.lensTitle}</SectionTitle>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                {S.lensIntro}
              </p>
            </div>
            <span className="w-fit rounded-full border border-white/10 px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-muted">
              {S.lensLabel}
            </span>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {S.lenses.map((lens) => (
              <article
                key={lens.role}
                className="flex flex-col rounded-xl border border-line bg-night p-5"
              >
                <h3 className="font-display text-xl font-semibold text-ink">
                  {lens.role}
                </h3>
                <p className="mt-4 text-xs font-semibold text-muted">
                  {S.lensFirst}
                </p>
                <ul className="mt-2 space-y-2">
                  {(lens.risks as [string, number, number][]).map(
                    ([title, p, i]) => {
                      const score = p * i;
                      const level = levelOf(score);
                      return (
                        <li
                          key={title}
                          className="flex items-center justify-between gap-3 rounded-lg border border-line bg-abyss px-3 py-2.5"
                        >
                          <span className="text-sm leading-snug text-ink">
                            {title}
                          </span>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[0.68rem] ${LEVEL_STYLE[level]}`}
                            title={S.levels[level]}
                          >
                            {p}×{i}={score}
                          </span>
                        </li>
                      );
                    },
                  )}
                </ul>
                <div className="mt-auto pt-5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                    <HelpCircle className="size-3.5 text-teal" aria-hidden />
                    {S.lensQuestion}
                  </p>
                  <p className="mt-1.5 font-display text-lg italic leading-snug text-ink/90">
                    {lang === "fr"
                      ? `« ${lens.question} »`
                      : `“${lens.question}”`}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ teams and sizes */}
      <section aria-labelledby="more-title" className="border-t border-line">
        <div className={`${container} py-14 lg:py-16`}>
          <SectionTitle id="more-title">{S.moreTitle}</SectionTitle>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-line bg-abyss/60 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted/80">
                {S.teamsLabel}
              </h3>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {S.teams.map(([name, body], idx) => {
                  const TeamIcon = TEAM_ICONS[idx];
                  return (
                    <li key={name}>
                      <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                        <TeamIcon className="size-3.5 text-teal" aria-hidden />
                        {name}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted">
                        {body}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="rounded-xl border border-line bg-abyss/60 p-5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted/80">
                {S.sizesLabel}
              </h3>
              <ul className="mt-4 space-y-4">
                {S.sizes.map(([name, body], idx) => {
                  const Icon = SIZE_ICONS[idx];
                  return (
                    <li key={name} className="flex gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-teal/30 bg-teal/10">
                        <Icon className="size-4 text-teal" aria-hidden />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-ink">{name}</p>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted">
                          {body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
