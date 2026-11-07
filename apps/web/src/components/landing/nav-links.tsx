"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { href: string; label: string };

/** The home link is active only on the home page; others also on their sub-pages. */
function isActive(pathname: string, href: string, home: string): boolean {
  if (href === home) return pathname === home || pathname === `${home}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({
  links,
  home,
  variant,
}: {
  links: NavLink[];
  home: string;
  variant: "desktop" | "mobile";
}) {
  const pathname = usePathname();

  return links.map((l) => {
    const active = isActive(pathname, l.href, home);
    if (variant === "desktop") {
      return (
        <Link
          key={l.href}
          href={l.href}
          aria-current={active ? "page" : undefined}
          className={`relative py-2 transition-colors hover:text-ink ${active ? "text-ink" : ""}`}
        >
          {l.label}
          {/* Active marker: a short teal bar under the label. */}
          <span
            aria-hidden
            className={`absolute -bottom-0.5 left-1/2 h-0.5 -translate-x-1/2 rounded-full bg-teal transition-all duration-300 ${
              active ? "w-5 opacity-100" : "w-0 opacity-0"
            }`}
          />
        </Link>
      );
    }
    return (
      <Link
        key={l.href}
        href={l.href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center justify-between rounded-lg px-3 py-3 transition-colors hover:bg-white/5 ${
          active ? "bg-white/[0.06] text-ink" : "text-ink/85"
        }`}
      >
        {l.label}
        {active && (
          <span aria-hidden className="size-1.5 rounded-full bg-teal" />
        )}
      </Link>
    );
  });
}
