import { NextResponse, type NextRequest } from "next/server";

import { hasLocale, negotiateLocale } from "@/i18n/config";

const LOCALE_COOKIE = "dg_locale";

/** Redirect locale-less paths to /{locale}/..., preferring the saved cookie, then Accept-Language. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  if (hasLocale(first)) return;

  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale =
    saved && hasLocale(saved) ? saved : negotiateLocale(request.headers.get("accept-language"));

  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip Next internals, API routes and static files.
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
