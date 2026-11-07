import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { container, CtaBand, PageIntro, PageShell, SecurityDetailed } from "@/components/landing/sections";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/securite">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.pages.security.meta, description: dict.pages.security.intro };
}

export default async function Page({ params }: PageProps<"/[lang]/securite">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const L = dict.landing;
  const P = dict.pages.security;

  return (
    <PageShell dict={dict} lang={lang}>
      <PageIntro title={P.title} intro={P.intro} lang={lang} back={dict.pages.back} />
      <section className={`${container} py-14`}>
        <SecurityDetailed l={L} />
      </section>
      <CtaBand l={L} lang={lang} />
    </PageShell>
  );
}
