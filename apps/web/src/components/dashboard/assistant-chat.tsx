"use client";

/** Conversation with the analysis assistant about one dossier. Nothing is stored server-side. */
import {
  ArrowUp,
  Bot,
  FlaskConical,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";

import { Alert } from "@/components/ui/form";
import type { Dictionary } from "@/i18n/dictionaries";
import { api } from "@/lib/client-api";
import { level, LEVEL_CHIP } from "@/lib/risk";
import { useApiError } from "@/lib/use-api-error";

import { ctaGhost } from "./cockpit";
import { Avatar } from "./ui";

type D = Dictionary["dash"];
type Citation = {
  ref: number;
  agent: string;
  title: string;
  severity: number;
  finding_id: string;
};
type Answer = {
  answer: string;
  citations: Citation[];
  confidence: "low" | "medium" | "high";
  simulated: boolean;
  model: string | null;
};
type Message =
  | { role: "user"; content: string }
  | ({ role: "assistant"; content: string } & Omit<Answer, "answer">);

/** "**text**" in an answer reads as emphasis; everything else stays plain text. */
function bold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).map((chunk, k) =>
    /^\*\*[^*]+\*\*$/.test(chunk) ? (
      <strong key={k} className="font-semibold text-ink">
        {chunk.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={k}>{chunk}</Fragment>
    ),
  );
}

/** Answer text with [n] references turned into links to the cited findings. */
function AnswerText({
  text,
  citations,
  href,
}: {
  text: string;
  citations: Citation[];
  href: (c: Citation) => string;
}) {
  const byRef = new Map(citations.map((c) => [c.ref, c]));
  return (
    <>
      {text.split(/\n{2,}|\n/).map((line, i) => {
        // "- item" lines read as a bulleted list.
        const bullet = /^\s*[-•]\s+/.test(line);
        const para = line.replace(/^\s*[-•]\s+/, "");
        return (
          <p
            key={i}
            className={`leading-relaxed [&+p]:mt-2 ${bullet ? "relative pl-4 before:absolute before:left-1 before:top-[0.6em] before:size-1 before:rounded-full before:bg-teal" : ""}`}
          >
            {para.split(/(\[\d+\])/).map((part, j) => {
              const m = part.match(/^\[(\d+)\]$/);
              const c = m ? byRef.get(Number(m[1])) : undefined;
              if (!m) return <Fragment key={j}>{bold(part)}</Fragment>;
              return c ? (
                <Link
                  key={j}
                  href={href(c)}
                  title={c.title}
                  className="mx-0.5 inline-flex items-center rounded-md border border-electric/40 bg-electric/10 px-1 align-[1px] font-mono text-[0.68rem] text-[#9dbcff] hover:bg-electric/20"
                >
                  {m[1]}
                </Link>
              ) : (
                <span key={j} className="font-mono text-[0.7rem] text-muted">
                  {part}
                </span>
              );
            })}
          </p>
        );
      })}
    </>
  );
}

export function AssistantChat({
  d,
  orgId,
  analysisId,
  decisionHref,
  userName,
}: {
  d: D;
  orgId: string;
  analysisId: string;
  decisionHref: string;
  userName: string;
}) {
  const Q = d.questions;
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const { error, setError, capture } = useApiError(d.common.error);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (q.length < 3 || busy) return;
    const history = messages
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: q }]);
    setDraft("");
    setBusy(true);
    setError(null);
    try {
      const r = await api<Answer>(`/orgs/${orgId}/analyses/${analysisId}/ask`, {
        body: { question: q, history },
      });
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: r.answer,
          citations: r.citations,
          confidence: r.confidence,
          simulated: r.simulated,
          model: r.model,
        },
      ]);
    } catch (e) {
      capture(e);
    } finally {
      setBusy(false);
    }
  };

  const findingHref = (c: Citation) =>
    `${decisionHref}#finding-${c.finding_id}`;

  return (
    <div className="flex min-h-[32rem] flex-col rounded-2xl border border-line bg-abyss/80">
      <div className="flex-1 space-y-5 p-5 sm:p-6" aria-live="polite">
        {/* Welcome */}
        <div className="flex gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-teal/30 bg-teal/10">
            <Bot className="size-4 text-teal" aria-hidden />
          </span>
          <div className="max-w-2xl rounded-2xl rounded-tl-sm border border-line bg-night/60 px-4 py-3 text-sm text-ink">
            {Q.welcome}
          </div>
        </div>
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 pl-12">
            {Q.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s)}
                className="inline-flex items-center gap-1.5 rounded-full border border-electric/30 bg-electric/[0.06] px-3 py-1.5 text-xs text-ink transition-colors hover:bg-electric/15"
              >
                <Sparkles className="size-3.5 text-teal" aria-hidden />
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end gap-3">
              <div className="max-w-2xl rounded-2xl rounded-tr-sm bg-electric/20 px-4 py-3 text-sm text-ink">
                {m.content}
              </div>
              <Avatar name={userName} />
            </div>
          ) : (
            <div key={i} className="flex gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-teal/30 bg-teal/10">
                <Bot className="size-4 text-teal" aria-hidden />
              </span>
              <div className="min-w-0 max-w-3xl flex-1 rounded-2xl rounded-tl-sm border border-line bg-night/60 px-4 py-3 text-sm text-ink">
                {m.simulated && (
                  <p className="mb-2 flex items-center gap-1.5 text-xs text-risk-moderate">
                    <FlaskConical className="size-3.5" aria-hidden />
                    {Q.simulated}
                  </p>
                )}
                <AnswerText
                  text={m.content}
                  citations={m.citations}
                  href={findingHref}
                />
                {m.citations.length > 0 && (
                  <div className="mt-3 border-t border-line pt-3">
                    <p className="font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
                      {Q.sources}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {m.citations.map((c) => (
                        <li key={c.ref}>
                          <Link
                            href={findingHref(c)}
                            className="group flex items-start gap-2 text-xs"
                          >
                            <span className="mt-0.5 font-mono text-[#9dbcff]">
                              [{c.ref}]
                            </span>
                            <span className="min-w-0 flex-1 text-ink/90 group-hover:text-teal">
                              {c.title}
                              <span className="text-muted">
                                {" · "}
                                {d.agentCatalog[
                                  c.agent as keyof typeof d.agentCatalog
                                ]?.name ?? c.agent}
                              </span>
                            </span>
                            <span
                              className={`shrink-0 rounded-md border px-1.5 text-[0.64rem] ${LEVEL_CHIP[level(c.severity)]}`}
                            >
                              {c.severity}/25
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="mt-2 text-[0.68rem] text-muted">
                  {Q.confidence[m.confidence]}
                  {m.model && !m.simulated ? ` · ${m.model}` : ""}
                </p>
              </div>
            </div>
          ),
        )}

        {busy && (
          <div className="flex items-center gap-3 pl-12 text-sm text-muted">
            <Loader2 className="size-4 animate-spin text-teal" aria-hidden />
            {Q.thinking}
          </div>
        )}
        {error && (
          <div className="pl-12">
            <Alert tone="error">{error}</Alert>
          </div>
        )}
        <div ref={end} />
      </div>

      <form
        className="border-t border-line p-3 sm:p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(draft);
        }}
      >
        <div className="flex items-end gap-2">
          <label htmlFor="assistant-q" className="sr-only">
            {Q.placeholder}
          </label>
          <textarea
            id="assistant-q"
            rows={2}
            maxLength={1000}
            value={draft}
            placeholder={Q.placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void ask(draft);
              }
            }}
            className="block min-h-[2.75rem] flex-1 resize-none rounded-xl border border-line bg-night/60 px-3.5 py-2.5 text-sm text-ink placeholder:text-muted/80 focus:border-electric/50 focus:outline-none focus:ring-2 focus:ring-electric/20"
          />
          <button
            type="submit"
            aria-label={Q.send}
            disabled={busy || draft.trim().length < 3}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-electric to-teal text-night transition-[filter] hover:brightness-110 disabled:opacity-40"
          >
            <ArrowUp className="size-5" aria-hidden />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.68rem] text-muted">{Q.limit}</p>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                setError(null);
              }}
              className={`${ctaGhost} py-1 text-xs`}
            >
              <RotateCcw className="size-3.5" aria-hidden />
              {Q.clear}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
