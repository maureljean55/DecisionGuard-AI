"use client";

/** Interactive pieces of the dashboard. Every mutation goes through the API, then refreshes. */
import { ChevronDown, Laptop, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";

import {
  Alert,
  PasswordInput,
  SelectInput,
  SubmitButton,
  TextInput,
} from "@/components/ui/form";
import type { Dictionary } from "@/i18n/dictionaries";
import { api } from "@/lib/client-api";
import { fmt } from "@/lib/format";
import { COUNTRY_CURRENCY, CURRENCIES, countryOptions } from "@/lib/geo";
import { assignableRoles, canManageMember } from "@/lib/permissions";
import type {
  AuditPage,
  Invitation,
  Member,
  Organization,
  Role,
  SessionInfo,
} from "@/lib/types";
import { describeAction } from "@/lib/dash-format";
import { LocalTime } from "@/components/dashboard/local-time";
import { useApiError } from "@/lib/use-api-error";

import { Avatar, buttonGhost, ConfirmButton, RoleBadge } from "./ui";

type D = Dictionary["dash"];

/** Insert a React node in place of {date} in a translated sentence. */
function withDate(template: string, node: React.ReactNode) {
  const [before, after = ""] = template.split("{date}");
  return (
    <>
      {before}
      {node}
      {after}
    </>
  );
}

function useMutation(errorText: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const { error, setError, capture } = useApiError(errorText);
  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setPending(true);
    setError(null);
    setDone(null);
    try {
      await fn();
      if (success) setDone(success);
      router.refresh();
      return true;
    } catch (e) {
      capture(e);
      return false;
    } finally {
      setPending(false);
    }
  };
  return { pending, error, done, run, router };
}

// ------------------------------------------------------------------ organisation

type OrgFields = {
  name: string;
  country: string;
  currency: string;
  locale: "fr" | "en";
};

function OrgFieldsInputs({
  d,
  lang,
  v,
  set,
  disabled,
  labels,
}: {
  d: D;
  lang: string;
  v: OrgFields;
  set: (v: OrgFields) => void;
  disabled?: boolean;
  labels: { name: string; country: string; currency: string; language: string };
}) {
  const countries = useMemo(() => countryOptions(lang), [lang]);
  void d;
  return (
    <div className="space-y-5">
      <TextInput
        label={labels.name}
        required
        maxLength={200}
        disabled={disabled}
        value={v.name}
        onChange={(e) => set({ ...v, name: e.target.value })}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectInput
          label={labels.country}
          disabled={disabled}
          value={v.country}
          onChange={(e) =>
            set({
              ...v,
              country: e.target.value,
              currency: COUNTRY_CURRENCY[e.target.value] ?? v.currency,
            })
          }
        >
          {countries.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </SelectInput>
        <SelectInput
          label={labels.currency}
          disabled={disabled}
          value={v.currency}
          onChange={(e) => set({ ...v, currency: e.target.value })}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectInput>
      </div>
      <SelectInput
        label={labels.language}
        disabled={disabled}
        value={v.locale}
        onChange={(e) => set({ ...v, locale: e.target.value as "fr" | "en" })}
      >
        <option value="fr">Français</option>
        <option value="en">English</option>
      </SelectInput>
    </div>
  );
}

export function OrgSettingsForm({
  d,
  lang,
  org,
  editable,
}: {
  d: D;
  lang: string;
  org: Organization;
  editable: boolean;
}) {
  const [v, setV] = useState<OrgFields>({
    name: org.name,
    country: org.country_code,
    currency: org.currency,
    locale: org.default_locale,
  });
  const m = useMutation(d.common.error);
  return (
    <form
      noValidate
      className="max-w-xl space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void m.run(
          () =>
            api(`/orgs/${org.id}`, {
              method: "PATCH",
              body: {
                name: v.name,
                country_code: v.country,
                currency: v.currency,
                default_locale: v.locale,
              },
            }),
          d.common.saved,
        );
      }}
    >
      {m.error && <Alert tone="error">{m.error}</Alert>}
      {m.done && <Alert tone="success">{m.done}</Alert>}
      {!editable && <Alert tone="error">{d.common.readOnly}</Alert>}
      <OrgFieldsInputs
        d={d}
        lang={lang}
        v={v}
        set={setV}
        disabled={!editable}
        labels={d.settings}
      />
      {editable && (
        <div className="sm:max-w-[12rem]">
          <SubmitButton pending={m.pending}>{d.common.save}</SubmitButton>
        </div>
      )}
    </form>
  );
}

export function CreateOrgForm({ d, lang }: { d: D; lang: string }) {
  const [v, setV] = useState<OrgFields>({
    name: "",
    country: "CM",
    currency: "XAF",
    locale: lang as "fr" | "en",
  });
  const m = useMutation(d.common.error);
  return (
    <form
      noValidate
      className="max-w-xl space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        let id = "";
        const ok = await m.run(async () => {
          const org = await api<Organization>("/orgs", {
            body: {
              name: v.name,
              country_code: v.country,
              currency: v.currency,
              default_locale: v.locale,
            },
          });
          id = org.id;
        });
        if (ok && id) m.router.push(`/${lang}/app/${id}`);
      }}
    >
      {m.error && <Alert tone="error">{m.error}</Alert>}
      <OrgFieldsInputs d={d} lang={lang} v={v} set={setV} labels={d.settings} />
      <div className="sm:max-w-xs">
        <SubmitButton pending={m.pending}>{d.newOrg.submit}</SubmitButton>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ team

function RoleSelect({
  d,
  value,
  options,
  onChange,
  disabled,
}: {
  d: D;
  value: Role;
  options: Role[];
  onChange: (r: Role) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative inline-block">
      <select
        aria-label={d.team.role}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as Role)}
        className="appearance-none rounded-full border border-line bg-night py-1.5 pl-3 pr-8 text-sm text-ink focus:border-teal focus:outline-none disabled:opacity-60"
      >
        {options.map((r) => (
          <option key={r} value={r}>
            {d.roles[r]}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
        aria-hidden
      />
    </div>
  );
}

export function MembersList({
  d,
  lang,
  org,
  members,
  meId,
}: {
  d: D;
  lang: string;
  org: Organization;
  members: Member[];
  meId: string;
}) {
  const m = useMutation(d.common.error);
  const options = assignableRoles(org.role);
  return (
    <div>
      {m.error && (
        <div className="mb-4">
          <Alert tone="error">{m.error}</Alert>
        </div>
      )}
      {m.done && (
        <div className="mb-4">
          <Alert tone="success">{m.done}</Alert>
        </div>
      )}
      <ul className="divide-y divide-line">
        {members.map((mb) => {
          const isMe = mb.user_id === meId;
          const manageable = !isMe && canManageMember(org.role, mb.role);
          return (
            <li
              key={mb.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4 first:pt-0 last:pb-0"
            >
              <Avatar name={mb.full_name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {mb.full_name}
                  {isMe && (
                    <span className="ml-2 text-xs font-normal text-teal">
                      ({d.common.you})
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted">
                  {mb.email} · {d.common.since}{" "}
                  <LocalTime iso={mb.joined_at} lang={lang} />
                </p>
              </div>
              <div className="flex items-center gap-2">
                {manageable && options.includes(mb.role) ? (
                  <RoleSelect
                    d={d}
                    value={mb.role}
                    options={options}
                    disabled={m.pending}
                    onChange={(role) =>
                      void m.run(
                        () =>
                          api(`/orgs/${org.id}/members/${mb.id}`, {
                            method: "PATCH",
                            body: { role },
                          }),
                        d.team.roleChanged,
                      )
                    }
                  />
                ) : (
                  <RoleBadge role={mb.role} label={d.roles[mb.role]} />
                )}
                {manageable && (
                  <ConfirmButton
                    label={d.team.remove}
                    message={fmt(d.team.removeConfirm, { name: mb.full_name })}
                    confirmLabel={d.team.remove}
                    cancelLabel={d.common.cancel}
                    onConfirm={async () => {
                      await m.run(() =>
                        api(`/orgs/${org.id}/members/${mb.id}`, {
                          method: "DELETE",
                        }),
                      );
                    }}
                  />
                )}
                {isMe && (
                  <ConfirmButton
                    label={d.team.leave}
                    message={fmt(d.team.leaveConfirm, { org: org.name })}
                    confirmLabel={d.team.leave}
                    cancelLabel={d.common.cancel}
                    className={buttonGhost}
                    onConfirm={async () => {
                      const ok = await m.run(() =>
                        api(`/orgs/${org.id}/members/${mb.id}`, {
                          method: "DELETE",
                        }),
                      );
                      if (ok) m.router.replace(`/${lang}/app`);
                    }}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function InviteForm({ d, org }: { d: D; org: Organization }) {
  const options = assignableRoles(org.role);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("analyst");
  const m = useMutation(d.common.error);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const sent = email;
    const ok = await m.run(
      () => api(`/orgs/${org.id}/invitations`, { body: { email, role } }),
      fmt(d.team.invited, { email: sent }),
    );
    if (ok) setEmail("");
  };
  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      {m.error && <Alert tone="error">{m.error}</Alert>}
      {m.done && <Alert tone="success">{m.done}</Alert>}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <TextInput
          label={d.team.email}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <SelectInput
          label={d.team.role}
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
        >
          {options.map((r) => (
            <option key={r} value={r}>
              {d.roles[r]}
            </option>
          ))}
        </SelectInput>
      </div>
      <p className="text-xs text-muted">{d.team.roleHelp[role]}</p>
      <div className="sm:max-w-xs">
        <SubmitButton pending={m.pending}>{d.team.invite}</SubmitButton>
      </div>
    </form>
  );
}

export function PendingInvitations({
  d,
  lang,
  org,
  invitations,
}: {
  d: D;
  lang: string;
  org: Organization;
  invitations: Invitation[];
}) {
  const m = useMutation(d.common.error);
  if (!invitations.length)
    return <p className="text-sm text-muted">{d.team.pendingEmpty}</p>;
  return (
    <ul className="divide-y divide-line">
      {m.error && (
        <li className="pb-4">
          <Alert tone="error">{m.error}</Alert>
        </li>
      )}
      {invitations.map((inv) => (
        <li
          key={inv.id}
          className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
        >
          <div className="min-w-0">
            <p className="truncate text-sm text-ink">{inv.email}</p>
            <p className="text-xs text-muted">
              {withDate(
                d.team.expires,
                <LocalTime iso={inv.expires_at} lang={lang} />,
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RoleBadge role={inv.role} label={d.roles[inv.role]} />
            <ConfirmButton
              label={d.team.revoke}
              message={fmt(d.team.revokeConfirm, { email: inv.email })}
              confirmLabel={d.team.revoke}
              cancelLabel={d.common.cancel}
              className={buttonGhost}
              onConfirm={async () => {
                await m.run(() =>
                  api(`/orgs/${org.id}/invitations/${inv.id}`, {
                    method: "DELETE",
                  }),
                );
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------ activity

export function ActivityList({
  d,
  lang,
  orgId,
  initial,
}: {
  d: D;
  lang: string;
  orgId: string;
  initial: AuditPage;
}) {
  const [items, setItems] = useState(initial.items);
  const [next, setNext] = useState(initial.next_before_id);
  const [loading, setLoading] = useState(false);
  if (!items.length)
    return <p className="text-sm text-muted">{d.activity.empty}</p>;
  return (
    <div>
      <ol className="relative space-y-5 border-l border-line pl-6">
        {items.map((e) => (
          <li key={e.id} className="relative">
            <span
              aria-hidden
              className="absolute -left-[1.86rem] top-1.5 size-2.5 rounded-full border-2 border-night bg-teal"
            />
            <p className="text-sm text-ink">
              <span className="font-medium">
                {e.actor_name ?? d.activity.system}
              </span>{" "}
              {describeAction(d, e)}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              <LocalTime iso={e.created_at} lang={lang} withTime />
              {e.ip ? ` · ${e.ip}` : ""}
            </p>
          </li>
        ))}
      </ol>
      {next && (
        <button
          type="button"
          className={`${buttonGhost} mt-6`}
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              const page = await api<AuditPage>(
                `/orgs/${orgId}/audit-logs?before_id=${next}`,
              );
              setItems((cur) => [...cur, ...page.items]);
              setNext(page.next_before_id);
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? d.common.loading : d.activity.more}
        </button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ account

export function ProfileForm({
  d,
  lang,
  name,
  locale,
}: {
  d: D;
  lang: string;
  name: string;
  locale: "fr" | "en";
}) {
  const [v, setV] = useState({ name, locale });
  const m = useMutation(d.common.error);
  return (
    <form
      noValidate
      className="max-w-xl space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await m.run(
          () =>
            api("/auth/me", {
              method: "PATCH",
              body: { full_name: v.name, locale: v.locale },
            }),
          d.common.saved,
        );
        if (ok && v.locale !== lang) {
          document.cookie = `dg_locale=${v.locale}; path=/; max-age=31536000; samesite=lax`;
          m.router.replace(`/${v.locale}/app/account`);
        }
      }}
    >
      {m.error && <Alert tone="error">{m.error}</Alert>}
      {m.done && <Alert tone="success">{m.done}</Alert>}
      <TextInput
        label={d.account.fullName}
        autoComplete="name"
        required
        maxLength={200}
        value={v.name}
        onChange={(e) => setV({ ...v, name: e.target.value })}
      />
      <SelectInput
        label={d.account.language}
        value={v.locale}
        onChange={(e) => setV({ ...v, locale: e.target.value as "fr" | "en" })}
      >
        <option value="fr">Français</option>
        <option value="en">English</option>
      </SelectInput>
      <div className="sm:max-w-[12rem]">
        <SubmitButton pending={m.pending}>{d.common.save}</SubmitButton>
      </div>
    </form>
  );
}

export function PasswordForm({ d, auth }: { d: D; auth: Dictionary["auth"] }) {
  const [v, setV] = useState({ current: "", next: "" });
  const m = useMutation(d.common.error);
  return (
    <form
      noValidate
      className="max-w-xl space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const ok = await m.run(
          () =>
            api("/auth/password/change", {
              body: { current_password: v.current, new_password: v.next },
            }),
          d.account.changed,
        );
        if (ok) setV({ current: "", next: "" });
      }}
    >
      {m.error && <Alert tone="error">{m.error}</Alert>}
      {m.done && <Alert tone="success">{m.done}</Alert>}
      <PasswordInput
        label={d.account.current}
        autoComplete="current-password"
        required
        value={v.current}
        onChange={(e) => setV({ ...v, current: e.target.value })}
        showLabel={auth.showPassword}
        hideLabel={auth.hidePassword}
      />
      <PasswordInput
        label={d.account.new}
        hint={auth.passwordHint}
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
        value={v.next}
        onChange={(e) => setV({ ...v, next: e.target.value })}
        showLabel={auth.showPassword}
        hideLabel={auth.hidePassword}
      />
      <div className="sm:max-w-xs">
        <SubmitButton pending={m.pending}>{d.account.change}</SubmitButton>
      </div>
    </form>
  );
}

function describeDevice(
  ua: string | null,
  fallback: string,
): { label: string; mobile: boolean } {
  if (!ua) return { label: fallback, mobile: false };
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : null;
  const os = /iPhone|iPad/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  const label = [browser, os].filter(Boolean).join(" · ") || fallback;
  return { label, mobile: /Mobile|iPhone|Android/.test(ua) };
}

export function SessionsList({
  d,
  lang,
  sessions,
}: {
  d: D;
  lang: string;
  sessions: SessionInfo[];
}) {
  const m = useMutation(d.common.error);
  const others = sessions.filter((s) => !s.current).length;
  return (
    <div>
      {m.error && (
        <div className="mb-4">
          <Alert tone="error">{m.error}</Alert>
        </div>
      )}
      <ul className="divide-y divide-line">
        {sessions.map((s) => {
          const dev = describeDevice(s.user_agent, d.account.unknownDevice);
          const Icon = dev.mobile ? Smartphone : Laptop;
          return (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-night">
                  <Icon className="size-4 text-muted" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">
                    {dev.label}
                    {s.current && (
                      <span className="ml-2 rounded-full bg-teal/15 px-2 py-0.5 text-[0.68rem] text-teal">
                        {d.account.thisDevice}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {withDate(
                      d.account.lastSeen,
                      <LocalTime iso={s.last_seen_at} lang={lang} withTime />,
                    )}
                    {s.ip ? ` · ${s.ip}` : ""}
                  </p>
                </div>
              </div>
              {!s.current && (
                <button
                  type="button"
                  className={buttonGhost}
                  disabled={m.pending}
                  onClick={() =>
                    void m.run(() =>
                      api(`/auth/sessions/${s.id}`, { method: "DELETE" }),
                    )
                  }
                >
                  {d.account.revoke}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {others > 0 && (
        <div className="mt-5">
          <ConfirmButton
            label={d.account.revokeOthers}
            message={d.account.revokeOthersConfirm}
            confirmLabel={d.common.confirm}
            cancelLabel={d.common.cancel}
            onConfirm={async () => {
              await m.run(() =>
                api("/auth/sessions/revoke-others", { method: "POST" }),
              );
            }}
          />
        </div>
      )}
    </div>
  );
}
