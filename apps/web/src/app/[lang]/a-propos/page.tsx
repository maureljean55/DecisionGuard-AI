import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CtaBand, PageIntro, PageShell } from "@/components/landing/sections";
import { TextSections } from "@/components/landing/text-page";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/a-propos">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.legal.about.meta, description: dict.legal.about.intro };
}

export default async function Page({ params }: PageProps<"/[lang]/a-propos">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const P = dict.legal.about;

  return (
    <PageShell dict={dict} lang={lang}>
      <PageIntro
        title={P.title}
        intro={P.intro}
        lang={lang}
        back={dict.pages.back}
      />
      <TextSections sections={P.sections} marker={dict.legal.tbd} />
      <CtaBand l={dict.landing} lang={lang} />
    </PageShell>
  );
}
