import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AnalysisFlow } from "@/components/landing/analysis-flow";
import {
  container,
  CtaBand,
  EpistemicList,
  MethodSteps,
  PageIntro,
  PageShell,
  SectionTitle,
} from "@/components/landing/sections";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/methode">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.pages.method.meta, description: dict.pages.method.intro };
}

export default async function Page({ params }: PageProps<"/[lang]/methode">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const L = dict.landing;
  const P = dict.pages.method;

  return (
    <PageShell dict={dict} lang={lang}>
      <PageIntro title={P.title} intro={P.intro} lang={lang} back={dict.pages.back} />
      <section className={`${container} py-14`}>
        <MethodSteps l={L} />
      </section>
      <section aria-labelledby="flow-title" className="border-t border-line bg-abyss/60">
        <div className={`${container} py-14`}>
          <SectionTitle id="flow-title">{L.flow.title}</SectionTitle>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">{L.flow.intro}</p>
          <div className="mt-8 rounded-xl border border-line bg-night px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <AnalysisFlow f={L.flow} />
          </div>
        </div>
      </section>
      <section aria-labelledby="epistemic-title" className="border-t border-line">
        <div className={`${container} grid gap-10 py-14 lg:grid-cols-2`}>
          <div>
            <SectionTitle id="epistemic-title">{L.epistemic.title}</SectionTitle>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">{L.epistemic.intro}</p>
          </div>
          <EpistemicList l={L} />
        </div>
      </section>
      <CtaBand l={L} lang={lang} />
    </PageShell>
  );
}
