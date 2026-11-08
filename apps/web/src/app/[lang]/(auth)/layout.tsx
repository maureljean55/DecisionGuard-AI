import { Home } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";

/** Shared shell for authentication pages; each page brings its own frame. */
export default async function AuthLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <div className="theme-night relative isolate flex min-h-dvh flex-col overflow-x-clip">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(50%_40%_at_30%_0%,rgba(91,108,255,0.12),transparent_70%)]"
      />
      {/* No header on authentication pages: a single link back to the home page. */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-5 sm:px-6 lg:px-8">
        <Link
          href={`/${lang}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-muted transition-colors hover:bg-white/[0.07] hover:text-ink"
        >
          <Home className="size-4" aria-hidden />
          {dict.nav.homeLink}
        </Link>
      </div>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
