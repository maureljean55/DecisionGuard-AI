"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  HelpCircle,
  Hourglass,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/form";
import type { Dictionary } from "@/i18n/dictionaries";
import { api } from "@/lib/client-api";
import { fmt } from "@/lib/format";
import type { Analysis, AnalysisStatus, Question } from "@/lib/types";
import { useApiError } from "@/lib/use-api-error";

import { buttonGhost, buttonPrimary } from "./ui";

type D = Dictionary["dash"];

const ORDER: AnalysisStatus[] = [
  "collecting_info",
  "pending",
  "analyzing",
  "simulating",
  "verifying",
  "reporting",
];
const RUNNING: AnalysisStatus[] = [
  "analyzing",
  "simulating",
  "verifying",
  "reporting",
];

/** Progress through the six stages of the workflow. */
export function StageTimeline({ d, status }: { d: D; status: AnalysisStatus }) {
  const current = status === "completed" ? ORDER.length : ORDER.indexOf(status);
  return (
    <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {d.analysis.steps.map((label, i) => {
        const done = current > i || status === "completed";
        const active = current === i && status !== "failed";
        return (
          <li key={label} className="min-w-0">
            <span
              className={`block h-1.5 rounded-full ${
                done
                  ? "bg-teal"
                  : active
                    ? "animate-pulse bg-risk-moderate"
                    : "bg-line"
              }`}
            />
            <span
              className={`mt-2 block truncate text-xs ${done || active ? "text-ink" : "text-muted"}`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function QuestionItem({
  d,
  orgId,
  analysisId,
  q,
  canWrite,
}: {
  d: D;
  orgId: string;
  analysisId: string;
  q: Question;
  canWrite: boolean;
}) {
  const A = d.analysis;
  const router = useRouter();
  const [answer, setAnswer] = useState(q.answer ?? "");
  const [busy, setBusy] = useState(false);
  const { error, setError, capture } = useApiError(d.common.error);
  const label = (A.questions as Record<string, string>)[q.key] ?? q.key;

  const send = async (unknown: boolean) => {
    setBusy(true);
    setError(null);
    try {
      await api(`/orgs/${orgId}/analyses/${analysisId}/questions/${q.id}`, {
        method: "PUT",
        body: unknown ? { unknown: true } : { answer },
      });
      router.refresh();
    } catch (e) {
      capture(e);
    } finally {
      setBusy(false);
    }
  };

  const answered = q.answered_at !== null;
  return (
    <li className="rounded-xl border border-line bg-night p-4">
      <p className="flex items-start gap-2 text-sm font-medium text-ink">
        <HelpCircle className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
        {label}
      </p>
      {answered ? (
        <p className="mt-2 pl-6 text-sm text-muted">
          {q.unknown ? (
            <span className="rounded-full border border-line px-2 py-0.5 text-xs">
              {A.markedUnknown}
            </span>
          ) : (
            q.answer
          )}
        </p>
      ) : canWrite ? (
        <div className="mt-3 space-y-3 pl-6">
          {error && <Alert tone="error">{error}</Alert>}
          <label className="sr-only" htmlFor={`q-${q.id}`}>
            {A.yourAnswer}
          </label>
          <textarea
            id={`q-${q.id}`}
            rows={2}
            maxLength={2000}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="block w-full rounded-lg border border-line bg-abyss px-3.5 py-2.5 text-sm text-ink focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/20"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={buttonPrimary}
              disabled={busy || !answer.trim()}
              onClick={() => void send(false)}
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {A.save}
            </button>
            <button
              type="button"
              className={buttonGhost}
              disabled={busy}
              onClick={() => void send(true)}
            >
              {A.unknown}
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** Live view of the latest analysis of a decision. */
export function AnalysisPanel({
  d,
  orgId,
  analysis,
  canWrite,
}: {
  d: D;
  orgId: string;
  analysis: Analysis;
  canWrite: boolean;
}) {
  const A = d.analysis;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { error, capture } = useApiError(d.common.error);
  const live =
    RUNNING.includes(analysis.status) ||
    (analysis.status === "pending" && !analysis.waiting_reason);

  // Refresh while the analysis is moving, so progress shows without reloading.
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(t);
  }, [live, router]);

  let note: { icon: typeof Clock3; tone: string; text: string } | null = null;
  if (analysis.status === "pending")
    note =
      analysis.waiting_reason === "engine_unavailable"
        ? {
            icon: Hourglass,
            tone: "border-risk-moderate/30 bg-risk-moderate/[0.07]",
            text: A.engineWaiting,
          }
        : { icon: Clock3, tone: "border-line bg-night", text: A.queued };
  else if (RUNNING.includes(analysis.status))
    note = {
      icon: Loader2,
      tone: "border-iris/40 bg-iris/[0.07]",
      text: A.running,
    };
  else if (analysis.status === "completed")
    note = {
      icon: CheckCircle2,
      tone: "border-teal/40 bg-teal/[0.07]",
      text: A.completedNote,
    };
  else if (analysis.status === "failed")
    note = {
      icon: AlertTriangle,
      tone: "border-risk-critical/40 bg-risk-critical/[0.07]",
      text: fmt(A.failed, { code: analysis.error_code ?? "error" }),
    };

  const open = analysis.questions.filter((q) => q.answered_at === null).length;

  return (
    <section className="rounded-2xl border border-line bg-abyss/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-ink">{A.title}</h2>
        <span className="text-sm text-muted">{A.status[analysis.status]}</span>
      </div>
      {analysis.status !== "canceled" && (
        <div className="mt-5">
          <StageTimeline d={d} status={analysis.status} />
        </div>
      )}

      {note && (
        <div
          className={`mt-5 flex gap-3 rounded-xl border px-4 py-3 text-sm leading-relaxed text-ink ${note.tone}`}
        >
          <note.icon
            className={`mt-0.5 size-4 shrink-0 ${note.icon === Loader2 ? "animate-spin" : ""}`}
            aria-hidden
          />
          <span>{note.text}</span>
        </div>
      )}

      {analysis.status === "failed" && canWrite && (
        <div className="mt-4 space-y-3">
          {error && <Alert tone="error">{error}</Alert>}
          <button
            type="button"
            className={buttonPrimary}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/orgs/${orgId}/analyses/${analysis.id}/retry`, {
                  method: "POST",
                });
                router.refresh();
              } catch (e) {
                capture(e);
              } finally {
                setBusy(false);
              }
            }}
          >
            {A.retry}
          </button>
        </div>
      )}

      {analysis.questions.length > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="font-medium text-ink">
            {A.questionsTitle}
            {open > 0 && (
              <span className="ml-2 text-sm font-normal text-risk-moderate">
                ({open})
              </span>
            )}
          </h3>
          {analysis.status === "collecting_info" && (
            <p className="mt-1 text-sm leading-relaxed text-muted">
              {A.questionsIntro}
            </p>
          )}
          <ul className="mt-4 space-y-3">
            {analysis.questions.map((q) => (
              <QuestionItem
                key={q.id}
                d={d}
                orgId={orgId}
                analysisId={analysis.id}
                q={q}
                canWrite={canWrite && analysis.status === "collecting_info"}
              />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
