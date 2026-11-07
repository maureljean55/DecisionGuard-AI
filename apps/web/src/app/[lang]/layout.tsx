import type { Metadata } from "next";
import { EB_Garamond, JetBrains_Mono, Manrope } from "next/font/google";
import { notFound } from "next/navigation";

import { hasLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

import "../globals.css";

// Display: an old-style Garamond with heraldic gravity (the shield, the owl's wisdom),
// chosen over Cormorant for its well-seated French accents (ê, ô, â).
const display = EB_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});
const body = Manrope({ variable: "--font-body", subsets: ["latin"] });
// Utility face for scores and figures: the risk engine is deterministic, numbers look it.
const mono = JetBrains_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "500"] });

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])) },
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  return (
    <html lang={lang} className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
