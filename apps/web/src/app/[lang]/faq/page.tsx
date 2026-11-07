import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  container,
  CtaBand,
  PageIntro,
  PageShell,
} from "@/components/landing/sections";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/faq">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.legal.faq.meta, description: dict.legal.faq.intro };
}

export default async function Page({ params }: PageProps<"/[lang]/faq">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const P = dict.legal.faq;

  return (
    <PageShell dict={dict} lang={lang}>
      <PageIntro title={P.title} intro={P.intro} />
      <section className={`${container} py-12`}>
        <div className="max-w-3xl divide-y divide-line border-y border-line">
          {P.items.map((item) => (
            <details key={item.q} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-left font-medium text-ink hover:text-teal [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown
                  className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <p className="pb-5 pr-10 text-sm leading-relaxed text-muted">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>
      <CtaBand l={dict.landing} lang={lang} />
    </PageShell>
  );
}
