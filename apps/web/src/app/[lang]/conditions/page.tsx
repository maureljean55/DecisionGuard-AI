import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageIntro, PageShell } from "@/components/landing/sections";
import { TextSections } from "@/components/landing/text-page";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/conditions">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.legal.terms.meta, description: dict.legal.terms.intro };
}

export default async function Page({
  params,
}: PageProps<"/[lang]/conditions">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const P = dict.legal.terms;

  return (
    <PageShell dict={dict} lang={lang}>
      <PageIntro
        title={P.title}
        intro={P.intro}
        lang={lang}
        back={dict.pages.back}
      />
      <TextSections
        sections={P.sections}
        updated={dict.legal.updated}
        marker={dict.legal.tbd}
      />
    </PageShell>
  );
}
