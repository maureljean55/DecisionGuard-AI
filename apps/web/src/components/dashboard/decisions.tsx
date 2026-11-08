"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, SelectInput, TextInput } from "@/components/ui/form";
import type { Dictionary } from "@/i18n/dictionaries";
import { api } from "@/lib/client-api";
import { fmt } from "@/lib/format";
import { CURRENCIES } from "@/lib/geo";
import type { Decision, DecisionCategory } from "@/lib/types";
import { useApiError } from "@/lib/use-api-error";

import { buttonGhost, buttonPrimary, ConfirmButton } from "./ui";

type D = Dictionary["dash"];
const CATEGORIES: DecisionCategory[] = [
  "strategic",
  "financial",
  "operational",
  "technological",
  "organizational",
  "commercial",
  "legal",
];

const area =
  "block w-full rounded-lg border border-line bg-night px-3.5 py-2.5 text-sm leading-relaxed text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20";

function TextArea({
  id,
  label,
  hint,
  value,
  onChange,
  rows,
  required,
  max,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  required?: boolean;
  max: number;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        required={required}
        maxLength={max}
        value={value}
        aria-describedby={`${id}-hint`}
        onChange={(e) => onChange(e.target.value)}
        className={area}
      />
      <p id={`${id}-hint`} className="text-xs text-muted">
        {hint}
      </p>
    </div>
  );
}

/** Create (no `decision`) or edit a decision. */
export function DecisionForm({
  d,
  lang,
  orgId,
  orgCurrency,
  decision,
}: {
  d: D;
  lang: string;
  orgId: string;
  orgCurrency: string;
  decision?: Decision;
}) {
  const F = d.decisions.form;
  const router = useRouter();
  const [v, setV] = useState({
    title: decision?.title ?? "",
    description: decision?.description ?? "",
    category: decision?.category ?? ("strategic" as DecisionCategory),
    amount: decision?.amount ? String(Number(decision.amount)) : "",
    currency: decision?.currency ?? orgCurrency,
    deadline: decision?.deadline ?? "",
    context: decision?.context ?? "",
  });
  const [pending, setPending] = useState<"draft" | "submit" | null>(null);
  const { error, setError, capture } = useApiError(d.common.error);

  const save = async (mode: "draft" | "submit") => {
    setPending(mode);
    setError(null);
    const body = {
      title: v.title,
      description: v.description,
      category: v.category,
      amount:
        v.amount.trim() === ""
          ? null
          : v.amount.replace(/\s/g, "").replace(",", "."),
      currency: v.amount.trim() === "" ? null : v.currency,
      deadline: v.deadline || null,
      context: v.context,
    };
    try {
      const saved = decision
        ? await api<Decision>(`/orgs/${orgId}/decisions/${decision.id}`, {
            method: "PATCH",
            body:
              mode === "submit" && decision.status === "draft"
                ? { ...body, status: "submitted" }
                : body,
          })
        : await api<Decision>(`/orgs/${orgId}/decisions`, {
            body: { ...body, submit: mode === "submit" },
          });
      router.push(`/${lang}/app/${orgId}/decisions/${saved.id}`);
      router.refresh();
    } catch (e) {
      capture(e);
      setPending(null);
    }
  };

  const set = (k: keyof typeof v) => (val: string) =>
    setV((x) => ({ ...x, [k]: val }));

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save(decision && decision.status !== "draft" ? "draft" : "submit");
      }}
    >
      {error && <Alert tone="error">{error}</Alert>}
      <TextInput
        label={F.title}
        hint={F.titleHint}
        required
        maxLength={200}
        value={v.title}
        onChange={(e) => set("title")(e.target.value)}
      />
      <TextArea
        id="dec-description"
        label={F.description}
        hint={F.descriptionHint}
        rows={5}
        required
        max={5000}
        value={v.description}
        onChange={set("description")}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectInput
          label={F.category}
          value={v.category}
          onChange={(e) => set("category")(e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {d.decisions.categories[c]}
            </option>
          ))}
        </SelectInput>
        <TextInput
          label={F.deadline}
          hint={F.deadlineHint}
          type="date"
          value={v.deadline}
          onChange={(e) => set("deadline")(e.target.value)}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <TextInput
          label={F.amount}
          hint={F.amountHint}
          inputMode="decimal"
          value={v.amount}
          onChange={(e) => set("amount")(e.target.value)}
        />
        <SelectInput
          label={F.currency}
          value={v.currency}
          onChange={(e) => set("currency")(e.target.value)}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectInput>
      </div>
      <TextArea
        id="dec-context"
        label={F.context}
        hint={F.contextHint}
        rows={4}
        max={5000}
        value={v.context}
        onChange={set("context")}
      />

      <div className="flex flex-col gap-3 border-t border-line pt-6 sm:flex-row">
        {decision && decision.status !== "draft" ? (
          <button
            type="submit"
            className={buttonPrimary}
            disabled={pending !== null}
          >
            {F.save}
          </button>
        ) : (
          <>
            <button
              type="submit"
              className={buttonPrimary}
              disabled={pending !== null}
            >
              {pending === "submit" ? d.common.loading : F.submit}
            </button>
            <button
              type="button"
              className={buttonGhost}
              disabled={pending !== null}
              onClick={() => void save("draft")}
            >
              {pending === "draft"
                ? d.common.loading
                : decision
                  ? F.save
                  : F.saveDraft}
            </button>
          </>
        )}
      </div>
    </form>
  );
}

/** Status actions on the decision page. */
export function DecisionActions({
  d,
  lang,
  orgId,
  decision,
  canWrite,
  canDelete,
}: {
  d: D;
  lang: string;
  orgId: string;
  decision: Decision;
  canWrite: boolean;
  canDelete: boolean;
}) {
  const T = d.decisions.detail;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { error, capture } = useApiError(d.common.error);
  const setStatus = async (status: "draft" | "submitted" | "archived") => {
    setBusy(true);
    try {
      await api(`/orgs/${orgId}/decisions/${decision.id}`, {
        method: "PATCH",
        body: { status },
      });
      router.refresh();
    } catch (e) {
      capture(e);
    } finally {
      setBusy(false);
    }
  };
  if (!canWrite) return null;
  return (
    <div className="space-y-3">
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {decision.status !== "archived" && (
          <a
            href={`/${lang}/app/${orgId}/decisions/${decision.id}/edit`}
            className={buttonGhost}
          >
            {T.edit}
          </a>
        )}
        {decision.status === "draft" && (
          <button
            type="button"
            className={buttonPrimary}
            disabled={busy}
            onClick={() => void setStatus("submitted")}
          >
            {T.submit}
          </button>
        )}
        {decision.status === "submitted" && (
          <button
            type="button"
            className={buttonGhost}
            disabled={busy}
            onClick={() => void setStatus("draft")}
          >
            {T.reopen}
          </button>
        )}
        {decision.status === "archived" ? (
          <button
            type="button"
            className={buttonGhost}
            disabled={busy}
            onClick={() => void setStatus("draft")}
          >
            {T.restore}
          </button>
        ) : (
          <ConfirmButton
            label={T.archive}
            message={T.archiveConfirm}
            confirmLabel={T.archive}
            cancelLabel={d.common.cancel}
            className={buttonGhost}
            onConfirm={() => setStatus("archived")}
          />
        )}
        {canDelete && (
          <ConfirmButton
            label={T.delete}
            message={fmt(T.deleteConfirm, { title: decision.title })}
            confirmLabel={T.delete}
            cancelLabel={d.common.cancel}
            onConfirm={async () => {
              try {
                await api(`/orgs/${orgId}/decisions/${decision.id}`, {
                  method: "DELETE",
                });
                router.replace(`/${lang}/app/${orgId}/decisions`);
                router.refresh();
              } catch (e) {
                capture(e);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}
