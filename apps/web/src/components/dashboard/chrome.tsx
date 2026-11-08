"use client";

/**
 * Dashboard chrome: sidebar (desktop), top bar with search, engine status and account menu,
 * slide-in drawer on mobile and tablet.
 */
import {
  Activity,
  Check,
  ChevronsUpDown,
  FolderKanban,
  Grid3x3,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  ScrollText,
  Search,
  Settings,
  SlidersHorizontal,
  User,
  Users,
  UsersRound,
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
import { AGENT_CATALOG } from "@/lib/agents";
import { api } from "@/lib/client-api";
import { fmt } from "@/lib/format";
import { canReadAudit } from "@/lib/permissions";
import type { EngineStatus, Me } from "@/lib/types";

import { Avatar } from "./ui";

type D = Dictionary["dash"];
type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
};
type NavGroup = { label?: string; items: NavItem[] };
type Membership = Me["memberships"][number];

const ENGINE_DOT: Record<EngineStatus["status"], string> = {
  active: "bg-teal shadow-[0_0_8px_var(--teal)]",
  simulated: "bg-risk-moderate",
  unavailable: "bg-muted",
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

function OrgSwitcher({
  d,
  lang,
  me,
  current,
  onNavigate,
}: {
  d: D;
  lang: string;
  me: Me;
  current: Membership;
  onNavigate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose<HTMLDivElement>(open, () => setOpen(false));
  const go = () => {
    setOpen(false);
    onNavigate?.();
  };
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={d.nav.switchOrg}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-xl border border-line bg-white/[0.03] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06]"
      >
        <span className="size-2 shrink-0 rounded-full bg-teal shadow-[0_0_8px_var(--teal)]" />
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted">
            {d.nav.space}
          </span>
          <span className="block truncate text-sm font-medium text-ink">
            {current.organization.name}
          </span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+0.4rem)] z-50 rounded-2xl border border-line bg-[#131d36] p-2 shadow-2xl shadow-black/60">
          <ul>
            {me.memberships.map((m) => (
              <li key={m.organization.id}>
                <Link
                  href={`/${lang}/app/${m.organization.id}`}
                  onClick={go}
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
            onClick={go}
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

function EngineCard({ d, engine }: { d: D; engine: EngineStatus | null }) {
  if (!engine) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white/[0.02] px-3 py-2.5">
      <span className="flex min-w-0 items-center gap-2">
        <span className={`size-1.5 shrink-0 rounded-full ${ENGINE_DOT[engine.status]}`} />
        <span className="truncate font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
          {d.nav.engineLabel}
        </span>
      </span>
      <span className="shrink-0 font-mono text-[0.7rem] text-teal">
        {engine.status === "unavailable"
          ? d.nav.engine.unavailable
          : fmt(d.nav.agentsLive, {
              n: String(engine.agents_active.length),
              total: String(AGENT_CATALOG.length),
            })}
      </span>
    </div>
  );
}

function Sidebar({
  d,
  lang,
  me,
  current,
  engine,
  nav,
  pathname,
  onNavigate,
}: {
  d: D;
  lang: string;
  me: Me;
  current: Membership | null;
  engine: EngineStatus | null;
  nav: NavGroup[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const isActive = (href: string, exact: boolean) =>
    exact
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex h-full flex-col">
      <Link
        href={`/${lang}`}
        className="flex items-center gap-2.5 px-5 pb-4 pt-5"
        onClick={onNavigate}
      >
        <Image
          src="/brand/owl-emblem-480.png"
          alt=""
          width={44}
          height={30}
          className="h-auto w-10"
        />
        <span className="font-display text-[1.15rem] font-semibold leading-none text-ink">
          DecisionGuard
        </span>
      </Link>

      {current && (
        <div className="px-3 pb-4">
          <OrgSwitcher
            d={d}
            lang={lang}
            me={me}
            current={current}
            onNavigate={onNavigate}
          />
        </div>
      )}

      <nav
        aria-label={d.nav.workspace}
        className="flex-1 space-y-5 overflow-y-auto px-3 pb-4"
      >
        {nav.map((group, gi) => (
          <div key={gi}>
            {group.label && (
              <p className="mb-1.5 px-3 font-mono text-[0.62rem] font-medium uppercase tracking-[0.14em] text-muted/70">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href, item.exact ?? false);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                        active
                          ? "border border-electric/30 bg-electric/[0.12] font-medium text-ink"
                          : "border border-transparent text-muted hover:bg-white/[0.04] hover:text-ink"
                      }`}
                    >
                      <Icon
                        className={`size-4 ${active ? "text-teal" : ""}`}
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t border-line p-3">
        <EngineCard d={d} engine={engine} />
        <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <Link
            href={`/${lang}/app/account`}
            onClick={onNavigate}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-lg hover:opacity-90"
          >
            <Avatar name={me.user.full_name} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-ink">
                {me.user.full_name}
              </span>
              <span className="block truncate text-xs text-muted">
                {current ? d.roles[current.role] : d.nav.account}
              </span>
            </span>
          </Link>
          <button
            type="button"
            aria-label={d.nav.logout}
            title={d.nav.logout}
            onClick={async () => {
              try {
                await api("/auth/logout", { method: "POST" });
              } finally {
                router.replace(`/${lang}/login`);
                router.refresh();
              }
            }}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-white/[0.06] hover:text-ink"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
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
        <div className="absolute right-0 top-12 z-50 w-64 rounded-2xl border border-line bg-[#131d36] p-2 shadow-2xl shadow-black/60">
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

function SearchBox({ d, base }: { d: D; base: string }) {
  return (
    <form
      action={`${base}/decisions`}
      role="search"
      className="relative hidden min-w-0 flex-1 sm:block sm:max-w-md"
    >
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
        aria-hidden
      />
      <label htmlFor="dash-search" className="sr-only">
        {d.nav.search}
      </label>
      <input
        id="dash-search"
        name="q"
        type="search"
        placeholder={d.nav.searchPlaceholder}
        className="h-10 w-full rounded-xl border border-line bg-white/[0.03] pl-10 pr-3 text-sm text-ink placeholder:text-muted/80 focus:border-electric/50 focus:outline-none focus:ring-2 focus:ring-electric/20"
      />
    </form>
  );
}

function EnginePill({ d, engine }: { d: D; engine: EngineStatus | null }) {
  if (!engine) return null;
  return (
    <span className="hidden items-center gap-2 rounded-xl border border-line bg-white/[0.03] px-3 py-2 md:inline-flex">
      <span className={`size-1.5 rounded-full ${ENGINE_DOT[engine.status]}`} />
      <span className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
        {d.nav.engineLabel}
      </span>
      <span
        className={`font-mono text-[0.72rem] font-medium ${
          engine.status === "active"
            ? "text-teal"
            : engine.status === "simulated"
              ? "text-risk-moderate"
              : "text-muted"
        }`}
      >
        {d.nav.engine[engine.status]}
        {engine.status !== "unavailable" &&
          ` (${engine.agents_active.length}/${AGENT_CATALOG.length})`}
      </span>
    </span>
  );
}

export function DashboardChrome({
  d,
  lang,
  me,
  engine,
  children,
}: {
  d: D;
  lang: string;
  me: Me;
  engine: EngineStatus | null;
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
  const nav: NavGroup[] = org
    ? [
        {
          items: [
            {
              href: base,
              label: d.nav.overview,
              icon: LayoutDashboard,
              exact: true,
            },
          ],
        },
        {
          label: d.nav.groupAnalysis,
          items: [
            {
              href: `${base}/decisions`,
              label: d.nav.decisions,
              icon: FolderKanban,
            },
            {
              href: `${base}/council`,
              label: d.nav.council,
              icon: UsersRound,
            },
            { href: `${base}/risk-map`, label: d.nav.riskMap, icon: Grid3x3 },
            {
              href: `${base}/simulator`,
              label: d.nav.simulator,
              icon: SlidersHorizontal,
            },
            { href: `${base}/reports`, label: d.nav.reports, icon: ScrollText },
          ],
        },
        {
          label: d.nav.groupOrg,
          items: [
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
          ],
        },
      ]
    : [];

  const sidebar = (onNavigate?: () => void) => (
    <Sidebar
      d={d}
      lang={lang}
      me={me}
      current={org}
      engine={engine}
      nav={nav}
      pathname={pathname}
      onNavigate={onNavigate}
    />
  );

  return (
    <div className="theme-night theme-cockpit min-h-dvh lg:grid lg:grid-cols-[16.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh border-r border-line bg-[#0b1122] lg:block">
        {sidebar()}
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
          <div className="absolute inset-y-0 left-0 w-72 border-r border-line bg-[#0b1122] shadow-2xl">
            <button
              type="button"
              aria-label={d.nav.close}
              onClick={() => setDrawer(false)}
              className="absolute right-3 top-4 z-10 flex size-9 items-center justify-center rounded-full text-muted hover:bg-white/[0.06] hover:text-ink"
            >
              <X className="size-4" />
            </button>
            {sidebar(() => setDrawer(false))}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-line bg-night/80 px-4 backdrop-blur-xl sm:px-6">
          <button
            type="button"
            aria-label={d.nav.menu}
            onClick={() => setDrawer(true)}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-line text-ink lg:hidden"
          >
            <Menu className="size-[1.1rem]" />
          </button>
          {org ? <SearchBox d={d} base={base} /> : <span className="flex-1" />}
          <span className="flex-1 sm:hidden" />
          <div className="ml-auto flex items-center gap-3">
            <EnginePill d={d} engine={engine} />
            <UserMenu d={d} lang={lang} me={me} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[90rem] flex-1 px-4 py-7 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
