"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import {
  Alert,
  SelectInput,
  SubmitButton,
  TextInput,
} from "@/components/ui/form";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { api } from "@/lib/client-api";
import { useApiError } from "@/lib/use-api-error";

type C = Dictionary["legal"]["contact"];
const TOPICS = ["pilot", "demo", "partnership", "other"] as const;

export function ContactForm({
  c,
  lang,
  networkError,
}: {
  c: C;
  lang: Locale;
  networkError: string;
}) {
  const empty = {
    name: "",
    email: "",
    company: "",
    topic: "pilot" as (typeof TOPICS)[number],
    message: "",
    website: "",
  };
  const [form, setForm] = useState(empty);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const { error, setError, capture } = useApiError(networkError);

  if (sent) {
    return (
      <div className="space-y-5">
        <Alert tone="success">{c.sent}</Alert>
        <button
          type="button"
          className="text-sm font-medium text-teal hover:text-ink"
          onClick={() => {
            setForm(empty);
            setSent(false);
          }}
        >
          {c.again}
        </button>
      </div>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api("/contact", { body: form });
      setSent(true);
    } catch (err) {
      capture(err);
    } finally {
      setPending(false);
    }
  };
  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <form noValidate onSubmit={submit} className="space-y-5">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput
          label={c.name}
          autoComplete="name"
          required
          maxLength={200}
          value={form.name}
          onChange={(e) => set("name")(e.target.value)}
        />
        <TextInput
          label={c.email}
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => set("email")(e.target.value)}
        />
        <TextInput
          label={c.company}
          autoComplete="organization"
          maxLength={200}
          value={form.company}
          onChange={(e) => set("company")(e.target.value)}
        />
        <SelectInput
          label={c.topic}
          value={form.topic}
          onChange={(e) => set("topic")(e.target.value)}
        >
          {TOPICS.map((t) => (
            <option key={t} value={t}>
              {c.topics[t]}
            </option>
          ))}
        </SelectInput>
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="contact-message"
          className="block text-sm font-medium text-ink"
        >
          {c.message}
        </label>
        <textarea
          id="contact-message"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          aria-describedby="contact-message-hint"
          value={form.message}
          onChange={(e) => set("message")(e.target.value)}
          className="block w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
        />
        <p id="contact-message-hint" className="text-xs text-muted">
          {c.messageHint}
        </p>
      </div>
      {/* Honeypot: invisible to people, tempting for bots. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
        value={form.website}
        onChange={(e) => set("website")(e.target.value)}
      />
      <p className="text-xs text-muted">
        <Link
          href={`/${lang}/confidentialite`}
          className="underline-offset-4 hover:text-ink hover:underline"
        >
          {c.privacy}
        </Link>
      </p>
      <div className="sm:max-w-xs">
        <SubmitButton pending={pending}>{c.submit}</SubmitButton>
      </div>
    </form>
  );
}
