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
          className={`rounded-full px-4 py-1.5 transition-colors ${
            active
              ? "bg-white/[0.09] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              : "text-muted hover:bg-white/[0.04] hover:text-ink"
          }`}
        >
          {l.label}
        </Link>
      );
    }
    return (
      <Link
        key={l.href}
        href={l.href}
        aria-current={active ? "page" : undefined}
        className={`flex items-center justify-between rounded-xl px-3 py-3 transition-colors hover:bg-white/5 ${
          active ? "bg-white/[0.06] text-ink" : "text-ink/85"
        }`}
      >
        {l.label}
        {active && <span aria-hidden className="size-1.5 rounded-full bg-teal" />}
      </Link>
    );
  });
}
