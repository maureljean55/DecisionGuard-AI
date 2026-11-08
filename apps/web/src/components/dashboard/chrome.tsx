"use client";

/**
 * Dashboard chrome: sidebar (desktop), top bar with organisation switcher and account menu,
 * slide-in drawer on mobile and tablet.
 */
import {
  Activity,
  BarChart3,
  Check,
  ChevronsUpDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Radar,
  ScrollText,
  Settings,
  User,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

import type { Dictionary } from "@/i18n/dictionaries";
import { api } from "@/lib/client-api";
import { canReadAudit } from "@/lib/permissions";
import type { Me } from "@/lib/types";

import { Avatar } from "./ui";

type D = Dictionary["dash"];
type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

function useOutsideClose<T extends HTMLElement>(
  open: boolean,
  close: () => void,
) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function Sidebar({
  d,
  lang,
  nav,
  pathname,
  onNavigate,
}: {
  d: D;
  lang: string;
  nav: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const soon = [
    { label: d.nav.decisions, icon: FileText },
    { label: d.nav.analyses, icon: BarChart3 },
    { label: d.nav.reports, icon: ScrollText },
    { label: d.nav.monitoring, icon: Radar },
  ];
  const isActive = (href: string, exact: boolean) =>
    exact
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex h-full flex-col">
      <Link
        href={`/${lang}`}
        className="flex items-center gap-2.5 px-5 py-5"
        onClick={onNavigate}
      >
        <Image
          src="/brand/owl-emblem-480.png"
          alt=""
          width={44}
          height={30}
          className="h-auto w-11"
        />
        <span className="font-display text-lg font-semibold text-ink">
          DecisionGuard
        </span>
      </Link>

      <nav
        aria-label={d.nav.workspace}
        className="flex-1 space-y-6 overflow-y-auto px-3 pb-4"
      >
        <ul className="space-y-0.5">
          {nav.map((item, i) => {
            const active = isActive(item.href, i === 0);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    active
                      ? "bg-white/[0.07] font-medium text-ink shadow-[inset_2px_0_0_0_var(--teal)]"
                      : "text-muted hover:bg-white/[0.04] hover:text-ink"
                  }`}
                >
                  <Icon className={`size-4 ${active ? "text-teal" : ""}`} />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div>
          <p className="px-3 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-muted/70">
            {d.nav.soon}
          </p>
          <ul className="mt-2 space-y-0.5">
            {soon.map(({ label, icon: Icon }) => (
              <li
                key={label}
                className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted/50"
              >
                <Icon className="size-4" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="border-t border-line p-3">
        <Link
          href={`/${lang}/app/account`}
          onClick={onNavigate}
          aria-current={
            pathname === `/${lang}/app/account` ? "page" : undefined
          }
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
            pathname === `/${lang}/app/account`
              ? "bg-white/[0.07] font-medium text-ink"
              : "text-muted hover:bg-white/[0.04] hover:text-ink"
          }`}
        >
          <User className="size-4" />
          {d.nav.account}
        </Link>
      </div>
    </div>
  );
}

function OrgSwitcher({
  d,
  lang,
  me,
  orgId,
}: {
  d: D;
  lang: string;
  me: Me;
  orgId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose<HTMLDivElement>(open, () => setOpen(false));
  const current =
    me.memberships.find((m) => m.organization.id === orgId) ??
    me.memberships[0];
  if (!current) return null;
  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        aria-expanded={open}
        aria-label={d.nav.switchOrg}
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[16rem] items-center gap-2 rounded-full border border-line bg-white/[0.03] py-1.5 pl-2 pr-3 text-sm text-ink transition-colors hover:bg-white/[0.06]"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-iris/30 text-[0.65rem] font-semibold">
          {current.organization.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="truncate">{current.organization.name}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-50 w-72 rounded-2xl border border-line bg-abyss p-2 shadow-2xl shadow-black/60">
          <ul>
            {me.memberships.map((m) => (
              <li key={m.organization.id}>
                <Link
                  href={`/${lang}/app/${m.organization.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-white/[0.05]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-ink">
                      {m.organization.name}
                    </span>
                    <span className="text-xs text-muted">
                      {d.roles[m.role]}
                    </span>
                  </span>
                  {m.organization.id === current.organization.id && (
                    <Check className="size-4 shrink-0 text-teal" aria-hidden />
                  )}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={`/${lang}/app/new`}
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-2 rounded-xl border-t border-line px-3 py-2.5 text-sm text-teal hover:bg-white/[0.05]"
          >
            <Plus className="size-4" aria-hidden />
            {d.nav.newOrg}
          </Link>
        </div>
      )}
    </div>
  );
}

function UserMenu({ d, lang, me }: { d: D; lang: string; me: Me }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={me.user.full_name}
        onClick={() => setOpen((o) => !o)}
        className="rounded-full transition-opacity hover:opacity-85"
      >
        <Avatar name={me.user.full_name} />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-line bg-abyss p-2 shadow-2xl shadow-black/60">
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-medium text-ink">
              {me.user.full_name}
            </p>
            <p className="truncate text-xs text-muted">{me.user.email}</p>
          </div>
          <div className="my-1 border-t border-line" />
          <Link
            href={`/${lang}/app/account`}
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-white/[0.05]"
          >
            <User className="size-4 text-muted" aria-hidden />
            {d.nav.account}
          </Link>
          <button
            type="button"
            onClick={async () => {
              try {
                await api("/auth/logout", { method: "POST" });
              } finally {
                router.replace(`/${lang}/login`);
                router.refresh();
              }
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-ink hover:bg-white/[0.05]"
          >
            <LogOut className="size-4 text-muted" aria-hidden />
            {d.nav.logout}
          </button>
        </div>
      )}
    </div>
  );
}

export function DashboardChrome({
  d,
  lang,
  me,
  children,
}: {
  d: D;
  lang: string;
  me: Me;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);

  // Organisation in the URL (/{lang}/app/{orgId}/...), if it is one of ours.
  const segment = pathname.split("/")[3] ?? null;
  const fromUrl = me.memberships.find((m) => m.organization.id === segment);
  const org = fromUrl ?? me.memberships[0] ?? null;

  // Remember the last organisation visited, so /app opens it next time.
  useEffect(() => {
    if (fromUrl)
      document.cookie = `dg_org=${fromUrl.organization.id}; path=/; max-age=31536000; samesite=lax`;
  }, [fromUrl]);

  const base = org ? `/${lang}/app/${org.organization.id}` : `/${lang}/app`;
  const nav: NavItem[] = org
    ? [
        { href: base, label: d.nav.overview, icon: LayoutDashboard },
        { href: `${base}/team`, label: d.nav.team, icon: Users },
        ...(canReadAudit(org.role)
          ? [
              {
                href: `${base}/activity`,
                label: d.nav.activity,
                icon: Activity,
              },
            ]
          : []),
        { href: `${base}/settings`, label: d.nav.settings, icon: Settings },
      ]
    : [];

  return (
    <div className="theme-night min-h-dvh lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-abyss/60 lg:block">
        <Sidebar d={d} lang={lang} nav={nav} pathname={pathname} />
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={d.nav.menu}
        >
          <button
            type="button"
            aria-label={d.nav.close}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setDrawer(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 border-r border-line bg-abyss shadow-2xl">
            <button
              type="button"
              aria-label={d.nav.close}
              onClick={() => setDrawer(false)}
              className="absolute right-3 top-4 flex size-9 items-center justify-center rounded-full text-muted hover:bg-white/[0.06] hover:text-ink"
            >
              <X className="size-4" />
            </button>
            <Sidebar
              d={d}
              lang={lang}
              nav={nav}
              pathname={pathname}
              onNavigate={() => setDrawer(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-line bg-night/80 px-4 backdrop-blur-xl sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label={d.nav.menu}
              onClick={() => setDrawer(true)}
              className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line text-ink lg:hidden"
            >
              <Menu className="size-[1.1rem]" />
            </button>
            <OrgSwitcher
              d={d}
              lang={lang}
              me={me}
              orgId={org?.organization.id ?? null}
            />
          </div>
          <UserMenu d={d} lang={lang} me={me} />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
