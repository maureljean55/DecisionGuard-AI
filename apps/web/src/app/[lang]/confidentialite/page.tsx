import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageIntro, PageShell } from "@/components/landing/sections";
import { TextSections } from "@/components/landing/text-page";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/confidentialite">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.legal.privacy.meta,
    description: dict.legal.privacy.intro,
  };
}

export default async function Page({
  params,
}: PageProps<"/[lang]/confidentialite">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const P = dict.legal.privacy;

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
