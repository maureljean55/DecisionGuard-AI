import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContactForm } from "@/components/landing/contact-form";
import { PageIntro, PageShell } from "@/components/landing/sections";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/contact">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.legal.contact.meta,
    description: dict.legal.contact.intro,
  };
}

export default async function Page({ params }: PageProps<"/[lang]/contact">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const P = dict.legal.contact;

  return (
    <PageShell dict={dict} lang={lang}>
      <PageIntro
        title={P.title}
        intro={P.intro}
        lang={lang}
        back={dict.pages.back}
      />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <ContactForm
            c={P}
            lang={lang}
            networkError={dict.auth.networkError}
          />
        </div>
      </div>
    </PageShell>
  );
}
