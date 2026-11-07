import { NextResponse, type NextRequest } from "next/server";

import { hasLocale, negotiateLocale } from "@/i18n/config";

const LOCALE_COOKIE = "dg_locale";
const SESSION_COOKIE = "dg_session";
// Authenticated areas (under /{locale}/...). The API remains the real authority:
// this is only an optimistic redirect to avoid rendering a page that would 401.
const PROTECTED = ["app"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const [, first = "", second = ""] = pathname.split("/");

  if (!hasLocale(first)) {
    // Redirect locale-less paths to /{locale}/..., preferring the saved cookie.
    const saved = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale =
      saved && hasLocale(saved) ? saved : negotiateLocale(request.headers.get("accept-language"));
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  if (PROTECTED.includes(second) && !request.cookies.has(SESSION_COOKIE)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${first}/login`;
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }
}

export const config = {
  // Skip Next internals, API relay and static files.
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
