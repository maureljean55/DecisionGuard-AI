"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { locales, type Locale } from "@/i18n/config";

export function LocaleSwitcher({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname();
  const rest = pathname.split("/").slice(2).join("/");

  return (
    <nav aria-label={label} className="flex rounded-md border border-line p-0.5 text-xs">
      {locales.map((locale) => (
        <Link
          key={locale}
          href={`/${locale}/${rest}`}
          hrefLang={locale}
          aria-current={locale === current ? "true" : undefined}
          onClick={() => {
            document.cookie = `dg_locale=${locale}; path=/; max-age=31536000; samesite=lax`;
          }}
          className={`rounded px-2 py-1 font-medium uppercase transition-colors ${
            locale === current ? "bg-navy-900 text-white" : "text-muted hover:text-ink"
          }`}
        >
          {locale}
        </Link>
      ))}
    </nav>
  );
}
