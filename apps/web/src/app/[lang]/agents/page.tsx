import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AgentsGrid, container, CtaBand, PageIntro, PageShell } from "@/components/landing/sections";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/agents">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.pages.agents.meta, description: dict.pages.agents.intro };
}

export default async function Page({ params }: PageProps<"/[lang]/agents">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const L = dict.landing;
  const P = dict.pages.agents;

  return (
    <PageShell dict={dict} lang={lang}>
      <PageIntro title={P.title} intro={P.intro} lang={lang} back={dict.pages.back} />
      <section className={`${container} py-14`}>
        <AgentsGrid l={L} />
      </section>
      <CtaBand l={L} lang={lang} />
    </PageShell>
  );
}
