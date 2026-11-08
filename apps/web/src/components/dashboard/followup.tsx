"use client";

/** Follow-up of a decision: periodic re-analysis setting and mitigation actions. */
import { Check, ListPlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/form";
import type { Dictionary } from "@/i18n/dictionaries";
import { api } from "@/lib/client-api";
import type { ActionStatus, Member, MitigationAction } from "@/lib/types";
import { useApiError } from "@/lib/use-api-error";

import { ctaGhost } from "./cockpit";

type D = Dictionary["dash"];
const field =
  "h-10 rounded-xl border border-line bg-night/60 px-3 text-sm text-ink focus:border-electric/50 focus:outline-none focus:ring-2 focus:ring-electric/20";
const STATUS_TONE: Record<ActionStatus, string> = {
  todo: "text-muted",
  in_progress: "text-[#7fa8ff]",
  done: "text-teal",
};

export function MonitoringSelect({
  d,
  orgId,
  decisionId,
  value,
  canWrite,
}: {
  d: D;
  orgId: string;
  decisionId: string;
  value: 30 | 90 | null;
  canWrite: boolean;
}) {
  const P = d.monitoring.panel;
  const router = useRouter();
  const [current, setCurrent] = useState(value === null ? "" : String(value));
  const [saved, setSaved] = useState(false);
  const { error, capture, setError } = useApiError(d.common.error);
  return (
    <div className="space-y-2">
      <label
        htmlFor="monitor-every"
        className="block text-sm font-medium text-ink"
      >
        {P.frequency}
      </label>
      <div className="flex items-center gap-3">
        <select
          id="monitor-every"
          value={current}
          disabled={!canWrite}
          onChange={async (e) => {
            const v = e.target.value;
            setCurrent(v);
            setSaved(false);
            setError(null);
            try {
              await api(`/orgs/${orgId}/decisions/${decisionId}/monitoring`, {
                method: "PUT",
                body: { every_days: v === "" ? null : Number(v) },
              });
              setSaved(true);
              router.refresh();
            } catch (err) {
              capture(err);
            }
          }}
          className={field}
        >
          <option value="">{P.none}</option>
          <option value="30">{P.every30}</option>
          <option value="90">{P.every90}</option>
        </select>
        {saved && (
          <span
            className="flex items-center gap-1 text-xs text-teal"
            role="status"
          >
            <Check className="size-3.5" aria-hidden />
            {P.saved}
          </span>
        )}
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <p className="text-xs leading-relaxed text-muted">{P.frequencyHelp}</p>
    </div>
  );
}

export function ActionStatusSelect({
  d,
  orgId,
  action,
  canWrite,
}: {
  d: D;
  orgId: string;
  action: MitigationAction;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const S = d.monitoring.status;
  if (!canWrite)
    return (
      <span className={`text-xs ${STATUS_TONE[action.status]}`}>
        {S[action.status]}
      </span>
    );
  return (
    <select
      aria-label={d.monitoring.col.actions}
      value={action.status}
      disabled={busy}
      onChange={async (e) => {
        setBusy(true);
        try {
          await api(`/orgs/${orgId}/actions/${action.id}`, {
            method: "PATCH",
            body: { status: e.target.value },
          });
          router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className={`h-8 rounded-lg border border-line bg-night/60 px-2 text-xs ${STATUS_TONE[action.status]}`}
    >
      {(["todo", "in_progress", "done"] as const).map((s) => (
        <option key={s} value={s}>
          {S[s]}
        </option>
      ))}
    </select>
  );
}

/** Add an action to a decision, optionally linked to one of its risks. */
export function AddActionForm({
  d,
  orgId,
  decisionId,
  members,
  risks,
}: {
  d: D;
  orgId: string;
  decisionId: string;
  members: Member[];
  /** Risks of the latest analysis, most severe first. */
  risks: { id: string; title: string; severity: number; mitigation: string }[];
}) {
  const P = d.monitoring.panel;
  const B = d.monitoring.board;
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [risk, setRisk] = useState("");
  const [owner, setOwner] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);
  const { error, capture, setError } = useApiError(d.common.error);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await api(`/orgs/${orgId}/decisions/${decisionId}/actions`, {
            body: {
              title,
              finding_id: risk || null,
              owner_user_id: owner || null,
              due_date: due || null,
            },
          });
          setTitle("");
          setRisk("");
          setOwner("");
          setDue("");
          router.refresh();
        } catch (err) {
          capture(err);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-sm font-medium text-ink">{P.add}</p>
      {error && <Alert tone="error">{error}</Alert>}
      {risks.length > 0 && (
        <>
          <label className="sr-only" htmlFor="action-risk">
            {B.risk}
          </label>
          <select
            id="action-risk"
            value={risk}
            onChange={(e) => {
              setRisk(e.target.value);
              const r = risks.find((x) => x.id === e.target.value);
              if (r && !title.trim()) setTitle(r.mitigation.slice(0, 300));
            }}
            className={`${field} w-full`}
          >
            <option value="">
              {B.risk} — {B.noRisk}
            </option>
            {risks.map((r) => (
              <option key={r.id} value={r.id}>
                {r.severity}/25 · {r.title}
              </option>
            ))}
          </select>
        </>
      )}
      <label htmlFor="action-title" className="sr-only">
        {P.titleField}
      </label>
      <input
        id="action-title"
        required
        minLength={3}
        maxLength={300}
        value={title}
        placeholder={P.titleField}
        onChange={(e) => setTitle(e.target.value)}
        className={`${field} w-full`}
      />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto]">
        <label className="sr-only" htmlFor="action-owner">
          {P.owner}
        </label>
        <select
          id="action-owner"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className={field}
        >
          <option value="">
            {P.owner} — {P.noOwner}
          </option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.full_name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="action-due">
          {P.due}
        </label>
        <input
          id="action-due"
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className={field}
        />
        <button
          type="submit"
          disabled={busy || title.trim().length < 3}
          className={ctaGhost}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ListPlus className="size-4" aria-hidden />
          )}
          {P.create}
        </button>
      </div>
    </form>
  );
}

/** "Create an action" on a finding: prefilled with the finding's mitigation. */
export function CreateActionButton({
  d,
  orgId,
  decisionId,
  findingId,
  title,
}: {
  d: D;
  orgId: string;
  decisionId: string;
  findingId: string;
  title: string;
}) {
  const P = d.monitoring.panel;
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">(
    "idle",
  );
  if (state === "done")
    return (
      <span
        className="inline-flex items-center gap-1 text-[11px] text-teal"
        role="status"
      >
        <Check className="size-3" aria-hidden />
        {P.created}
      </span>
    );
  return (
    <button
      type="button"
      disabled={state === "busy"}
      onClick={async () => {
        setState("busy");
        try {
          await api(`/orgs/${orgId}/decisions/${decisionId}/actions`, {
            body: { title: title.slice(0, 300), finding_id: findingId },
          });
          setState("done");
          router.refresh();
        } catch {
          setState("error");
        }
      }}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
        state === "error"
          ? "border-risk-critical/40 text-risk-critical"
          : "border-electric/30 text-[#7fa8ff] hover:bg-electric/10"
      }`}
    >
      {state === "busy" ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : (
        <ListPlus className="size-3" aria-hidden />
      )}
      {state === "error" ? d.common.error : P.fromFinding}
    </button>
  );
}
