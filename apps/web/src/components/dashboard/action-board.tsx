"use client";

/**
 * Mitigation actions as a three-column board (to do, in progress, done).
 * Priority comes from the severity of the linked risk; actions without a risk have none.
 */
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import type { Dictionary } from "@/i18n/dictionaries";
import { api } from "@/lib/client-api";
import { level, LEVEL_CHIP } from "@/lib/risk";
import type { ActionStatus, Member, MitigationAction } from "@/lib/types";

import { ctaGhost } from "./cockpit";
import { LocalTime } from "./local-time";
import { Avatar } from "./ui";

type D = Dictionary["dash"];
const COLUMNS: ActionStatus[] = ["todo", "in_progress", "done"];
const COLUMN_TONE: Record<ActionStatus, string> = {
  todo: "bg-muted/60",
  in_progress: "bg-electric",
  done: "bg-teal",
};
const field =
  "h-10 w-full rounded-xl border border-line bg-night/60 px-3 text-sm text-ink focus:border-electric/50 focus:outline-none focus:ring-2 focus:ring-electric/20";

function severityOf(a: MitigationAction): number | null {
  return a.finding_likelihood && a.finding_impact
    ? a.finding_likelihood * a.finding_impact
    : null;
}

function EditDialog({
  d,
  orgId,
  action,
  members,
}: {
  d: D;
  orgId: string;
  action: MitigationAction;
  members: Member[];
}) {
  const B = d.monitoring.board;
  const P = d.monitoring.panel;
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(action.title);
  const [owner, setOwner] = useState(action.owner_user_id ?? "");
  const [due, setDue] = useState(action.due_date ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={B.edit}
        title={B.edit}
        onClick={() => ref.current?.showModal()}
        className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-white/[0.06] hover:text-ink"
      >
        <Pencil className="size-3.5" />
      </button>
      <dialog
        ref={ref}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-[#131d36] p-0 text-ink backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <form
          className="space-y-4 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await api(`/orgs/${orgId}/actions/${action.id}`, {
                method: "PATCH",
                body: {
                  title,
                  ...(owner ? { owner_user_id: owner } : { clear_owner: true }),
                  ...(due ? { due_date: due } : { clear_due_date: true }),
                },
              });
              ref.current?.close();
              router.refresh();
            } finally {
              setBusy(false);
            }
          }}
        >
          <p className="font-display text-lg font-semibold">{B.edit}</p>
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">{P.titleField}</span>
            <input
              required
              minLength={3}
              maxLength={300}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={field}
            />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">{P.owner}</span>
            <select
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className={field}
            >
              <option value="">{P.noOwner}</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="text-muted">{P.due}</span>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className={field}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className={ctaGhost}
              onClick={() => ref.current?.close()}
            >
              {B.cancel}
            </button>
            <button type="submit" disabled={busy} className={ctaGhost}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {B.save}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function ActionCard({
  d,
  lang,
  orgId,
  action,
  members,
  canWrite,
  dossierHref,
  today,
}: {
  d: D;
  lang: string;
  orgId: string;
  action: MitigationAction;
  members: Member[];
  canWrite: boolean;
  dossierHref?: string;
  today: string;
}) {
  const B = d.monitoring.board;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const sev = severityOf(action);
  const late =
    action.status !== "done" &&
    action.due_date !== null &&
    action.due_date < today;
  const idx = COLUMNS.indexOf(action.status);
  const move = async (to: ActionStatus) => {
    setBusy(true);
    try {
      await api(`/orgs/${orgId}/actions/${action.id}`, {
        method: "PATCH",
        body: { status: to },
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <li
      className={`rounded-xl border bg-abyss/90 p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] ${
        late ? "border-risk-critical/40" : "border-line"
      } ${busy ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        {sev !== null ? (
          <span
            className={`rounded-md border px-1.5 py-0.5 text-[0.64rem] font-medium ${LEVEL_CHIP[level(sev)]}`}
            title={`${B.priority} · ${sev}/25`}
          >
            {d.levels[level(sev)]} · {sev}/25
          </span>
        ) : (
          <span className="rounded-md border border-line px-1.5 py-0.5 text-[0.64rem] text-muted">
            {B.noRisk}
          </span>
        )}
        {canWrite && (
          <span className="flex shrink-0 items-center">
            <EditDialog d={d} orgId={orgId} action={action} members={members} />
            <button
              type="button"
              aria-label={d.monitoring.panel.delete}
              title={d.monitoring.panel.delete}
              onClick={async () => {
                if (!window.confirm(d.monitoring.panel.deleteConfirm)) return;
                setBusy(true);
                await api(`/orgs/${orgId}/actions/${action.id}`, {
                  method: "DELETE",
                });
                router.refresh();
              }}
              className="flex size-7 items-center justify-center rounded-md text-muted hover:bg-white/[0.06] hover:text-risk-critical"
            >
              <Trash2 className="size-3.5" />
            </button>
          </span>
        )}
      </div>
      <p
        className={`mt-2 text-sm leading-snug ${action.status === "done" ? "text-muted line-through decoration-muted/50" : "text-ink"}`}
      >
        {action.title}
      </p>
      {action.finding_title && (
        <p className="mt-1.5 text-[0.7rem] leading-snug text-muted">
          <span className="text-ink/70">{B.risk} · </span>
          {action.finding_title}
        </p>
      )}
      {dossierHref && action.decision_title && (
        <Link
          href={dossierHref}
          className="mt-1 block truncate text-[0.7rem] text-teal hover:text-ink"
        >
          {action.decision_title}
        </Link>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[0.7rem] text-muted">
          {action.owner_name ? (
            <>
              <Avatar name={action.owner_name} size="sm" />
              <span className="truncate">{action.owner_name}</span>
            </>
          ) : (
            d.monitoring.panel.noOwner
          )}
        </span>
        {action.due_date && (
          <span
            className={`shrink-0 font-mono text-[0.68rem] ${late ? "text-risk-critical" : "text-muted"}`}
          >
            <LocalTime iso={`${action.due_date}T00:00:00Z`} lang={lang} />
          </span>
        )}
      </div>
      {canWrite && (
        <div className="mt-2.5 flex justify-between border-t border-line pt-2">
          <button
            type="button"
            disabled={idx === 0 || busy}
            onClick={() => void move(COLUMNS[idx - 1])}
            className="inline-flex items-center gap-0.5 text-[0.7rem] text-muted hover:text-ink disabled:invisible"
          >
            <ChevronLeft className="size-3.5" aria-hidden />
            {idx > 0 ? d.monitoring.status[COLUMNS[idx - 1]] : B.prev}
          </button>
          <button
            type="button"
            disabled={idx === COLUMNS.length - 1 || busy}
            onClick={() => void move(COLUMNS[idx + 1])}
            className="inline-flex items-center gap-0.5 text-[0.7rem] text-[#7fa8ff] hover:text-ink disabled:invisible"
          >
            {idx < COLUMNS.length - 1
              ? d.monitoring.status[COLUMNS[idx + 1]]
              : B.next}
            <ChevronRight className="size-3.5" aria-hidden />
          </button>
        </div>
      )}
    </li>
  );
}

export function ActionBoard({
  d,
  lang,
  orgId,
  actions,
  members,
  canWrite,
  base,
  today,
}: {
  d: D;
  lang: string;
  orgId: string;
  actions: MitigationAction[];
  members: Member[];
  canWrite: boolean;
  /** When set, cards link to their dossier (organisation-wide board). */
  base?: string;
  today: string;
}) {
  const B = d.monitoring.board;
  // Highest priority first, then nearest due date.
  const sorted = [...actions].sort(
    (a, b) =>
      (severityOf(b) ?? 0) - (severityOf(a) ?? 0) ||
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
  );
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {COLUMNS.map((col) => {
        const items = sorted.filter((a) => a.status === col);
        return (
          <section
            key={col}
            aria-label={d.monitoring.status[col]}
            className="rounded-2xl border border-line bg-night/40 p-3"
          >
            <header className="mb-3 flex items-center justify-between px-1">
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                <span className={`size-2 rounded-full ${COLUMN_TONE[col]}`} />
                {d.monitoring.status[col]}
              </span>
              <span className="rounded-md bg-white/[0.06] px-1.5 font-mono text-[0.68rem] text-muted">
                {items.length}
              </span>
            </header>
            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-xs text-muted">
                {B.empty}
              </p>
            ) : (
              <ul className="space-y-2.5">
                {items.map((a) => (
                  <ActionCard
                    key={a.id}
                    d={d}
                    lang={lang}
                    orgId={orgId}
                    action={a}
                    members={members}
                    canWrite={canWrite}
                    today={today}
                    dossierHref={
                      base ? `${base}/decisions/${a.decision_id}` : undefined
                    }
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
