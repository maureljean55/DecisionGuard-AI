"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { Alert, PasswordInput, SelectInput, SubmitButton, TextInput } from "@/components/ui/form";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { api, safeNext } from "@/lib/client-api";
import { fmt } from "@/lib/format";
import { COUNTRY_CURRENCY, CURRENCIES, countryOptions } from "@/lib/geo";
import type { InvitationPreview, Me } from "@/lib/types";
import { useApiError } from "@/lib/use-api-error";

type AuthDict = Dictionary["auth"];
interface Props {
  dict: AuthDict;
  lang: Locale;
}

const linkClass = "font-medium text-teal hover:text-ink";

function useSubmit(dict: AuthDict) {
  const [pending, setPending] = useState(false);
  const { error, setError, capture } = useApiError(dict.networkError);
  const run = async (e: FormEvent, action: () => Promise<void>) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      capture(err);
    } finally {
      setPending(false);
    }
  };
  return { pending, error, run };
}

// ------------------------------------------------------------------ login

export function LoginForm({ dict, lang }: Props) {
  const router = useRouter();
  const next = useSearchParams().get("next");
  const { pending, error, run } = useSubmit(dict);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) =>
        run(e, async () => {
          await api<Me>("/auth/login", { body: { email, password } });
          router.replace(safeNext(next, `/${lang}/app`));
          router.refresh();
        })
      }
    >
      {error && <Alert tone="error">{error}</Alert>}
      <TextInput
        label={dict.email}
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <PasswordInput
        label={dict.password}
        autoComplete="current-password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        showLabel={dict.showPassword}
        hideLabel={dict.hidePassword}
      />
      <div className="flex justify-end text-sm">
        <Link href={`/${lang}/forgot-password`} className={linkClass}>
          {dict.login.forgot}
        </Link>
      </div>
      <SubmitButton pending={pending}>{dict.login.submit}</SubmitButton>
      <p className="text-center text-sm text-muted">
        {dict.login.noAccount}{" "}
        <Link
          href={`/${lang}/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className={linkClass}
        >
          {dict.login.register}
        </Link>
      </p>
    </form>
  );
}

// ------------------------------------------------------------------ register

export function RegisterForm({ dict, lang }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  // Arriving from an invitation: the person joins an existing organization instead.
  const joining = Boolean(next?.includes("/invite"));
  const { pending, error, run } = useSubmit(dict);
  const countries = useMemo(() => countryOptions(lang), [lang]);
  const [form, setForm] = useState({
    full_name: "",
    email: params.get("email") ?? "",
    password: "",
    org: "",
    country: "CM",
    currency: "XAF",
    reportLocale: lang as Locale,
  });
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(e) =>
        run(e, async () => {
          await api<Me>("/auth/register", {
            body: {
              email: form.email,
              password: form.password,
              full_name: form.full_name,
              locale: lang,
              organization: joining
                ? undefined
                : {
                    name: form.org,
                    country_code: form.country,
                    currency: form.currency,
                    default_locale: form.reportLocale,
                  },
            },
          });
          router.replace(safeNext(next, `/${lang}/app`));
          router.refresh();
        })
      }
    >
      {error && <Alert tone="error">{error}</Alert>}
      <fieldset className="space-y-4">
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          {dict.register.you}
        </legend>
        <TextInput
          label={dict.fullName}
          autoComplete="name"
          required
          maxLength={200}
          value={form.full_name}
          onChange={(e) => set("full_name")(e.target.value)}
        />
        <TextInput
          label={dict.email}
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => set("email")(e.target.value)}
        />
        <PasswordInput
          label={dict.password}
          hint={dict.passwordHint}
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          value={form.password}
          onChange={(e) => set("password")(e.target.value)}
          showLabel={dict.showPassword}
          hideLabel={dict.hidePassword}
        />
      </fieldset>

      {!joining && (
      <fieldset className="space-y-4">
        <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">
          {dict.register.company}
        </legend>
        <TextInput
          label={dict.orgName}
          autoComplete="organization"
          required
          maxLength={200}
          value={form.org}
          onChange={(e) => set("org")(e.target.value)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectInput
            label={dict.country}
            value={form.country}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                country: e.target.value,
                currency: COUNTRY_CURRENCY[e.target.value] ?? f.currency,
              }))
            }
          >
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </SelectInput>
          <SelectInput
            label={dict.currency}
            value={form.currency}
            onChange={(e) => set("currency")(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectInput>
        </div>
        <SelectInput
          label={dict.language}
          value={form.reportLocale}
          onChange={(e) => set("reportLocale")(e.target.value)}
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
        </SelectInput>
      </fieldset>
      )}

      <p className="text-xs leading-relaxed text-muted">{dict.register.terms}</p>
      <SubmitButton pending={pending}>{dict.register.submit}</SubmitButton>
      <p className="text-center text-sm text-muted">
        {dict.register.hasAccount}{" "}
        <Link
          href={`/${lang}/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className={linkClass}
        >
          {dict.register.login}
        </Link>
      </p>
    </form>
  );
}

// ------------------------------------------------------------------ forgot / reset

export function ForgotPasswordForm({ dict, lang }: Props) {
  const { pending, error, run } = useSubmit(dict);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="space-y-6">
        <Alert tone="success">{dict.forgot.sent}</Alert>
        <Link href={`/${lang}/login`} className={`${linkClass} text-sm`}>
          {dict.forgot.back}
        </Link>
      </div>
    );
  }
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) =>
        run(e, async () => {
          await api("/auth/password/forgot", { body: { email } });
          setSent(true);
        })
      }
    >
      {error && <Alert tone="error">{error}</Alert>}
      <TextInput
        label={dict.email}
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <SubmitButton pending={pending}>{dict.forgot.submit}</SubmitButton>
      <p className="text-center text-sm">
        <Link href={`/${lang}/login`} className={linkClass}>
          {dict.forgot.back}
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ dict, lang }: Props) {
  const token = useSearchParams().get("token");
  const { pending, error, run } = useSubmit(dict);
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);

  if (!token) return <Alert tone="error">{dict.reset.missingToken}</Alert>;
  if (done) {
    return (
      <div className="space-y-6">
        <Alert tone="success">{dict.reset.done}</Alert>
        <Link href={`/${lang}/login`} className={`${linkClass} text-sm`}>
          {dict.forgot.back}
        </Link>
      </div>
    );
  }
  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(e) =>
        run(e, async () => {
          await api("/auth/password/reset", { body: { token, password } });
          setDone(true);
        })
      }
    >
      {error && <Alert tone="error">{error}</Alert>}
      <PasswordInput
        label={dict.password}
        hint={dict.passwordHint}
        autoComplete="new-password"
        required
        minLength={12}
        maxLength={128}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        showLabel={dict.showPassword}
        hideLabel={dict.hidePassword}
      />
      <SubmitButton pending={pending}>{dict.reset.submit}</SubmitButton>
    </form>
  );
}

// ------------------------------------------------------------------ verify e-mail

export function VerifyEmail({ dict, lang }: Props) {
  const token = useSearchParams().get("token");
  const [state, setState] = useState<"pending" | "done" | "error">("pending");
  const [message, setMessage] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return; // tokens are single-use: never submit twice
    started.current = true;
    api("/auth/verify-email", { body: { token } })
      .then(() => setState("done"))
      .catch((err: unknown) => {
        setState("error");
        setMessage(err instanceof Error && err.message ? err.message : dict.networkError);
      });
  }, [token, dict]);

  if (!token) return <Alert tone="error">{dict.reset.missingToken}</Alert>;
  if (state === "pending") return <p className="text-sm text-muted">{dict.verify.pending}</p>;
  return (
    <div className="space-y-6">
      <Alert tone={state === "done" ? "success" : "error"}>
        {state === "done" ? dict.verify.done : message}
      </Alert>
      <Link href={`/${lang}/app`} className={`${linkClass} text-sm`}>
        {dict.verify.continue}
      </Link>
    </div>
  );
}

// ------------------------------------------------------------------ invitation

export function AcceptInvitation({ dict, lang, signedInEmail }: Props & { signedInEmail: string | null }) {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const { pending, error, run } = useSubmit(dict);
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    api<InvitationPreview>(`/invitations/preview?token=${encodeURIComponent(token)}`)
      .then(setPreview)
      .catch((err: unknown) =>
        setLoadError(err instanceof Error && err.message ? err.message : dict.networkError),
      );
  }, [token, dict]);

  if (!token) return <Alert tone="error">{dict.reset.missingToken}</Alert>;
  if (loadError) return <Alert tone="error">{loadError}</Alert>;
  if (!preview) return <p className="text-sm text-muted">{dict.verify.pending}</p>;

  const here = `/${lang}/invite?token=${encodeURIComponent(token ?? "")}`;
  const body = fmt(dict.invite.body, {
    org: preview.organization_name,
    role: dict.roles[preview.role],
  });

  return (
    <div className="space-y-6">
      <p className="leading-relaxed text-ink">{body}</p>
      <p className="text-sm text-muted">{fmt(dict.invite.sentTo, { email: preview.email })}</p>
      {error && <Alert tone="error">{error}</Alert>}
      {signedInEmail ? (
        <form
          onSubmit={(e) =>
            run(e, async () => {
              await api("/invitations/accept", { body: { token } });
              router.replace(`/${lang}/app`);
              router.refresh();
            })
          }
        >
          <SubmitButton pending={pending}>{dict.invite.accept}</SubmitButton>
        </form>
      ) : (
        <div className="space-y-3 text-sm">
          <p>
            <Link href={`/${lang}/login?next=${encodeURIComponent(here)}`} className={linkClass}>
              {dict.invite.loginFirst}
            </Link>
          </p>
          <p>
            <Link
              href={`/${lang}/register?next=${encodeURIComponent(here)}&email=${encodeURIComponent(preview.email)}`}
              className={linkClass}
            >
              {dict.invite.registerFirst}
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
