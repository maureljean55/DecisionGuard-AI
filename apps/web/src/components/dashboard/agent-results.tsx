import {
  CircleAlert,
  FlaskConical,
  MessageCircleQuestion,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import type { Dictionary } from "@/i18n/dictionaries";
import { fmt } from "@/lib/format";
import type { AgentRun, Analysis, EvidenceType, Finding } from "@/lib/types";

import { HowToRead } from "./cockpit";
import { CreateActionButton } from "./followup";

type D = Dictionary["dash"];

// How firmly a statement is grounded, from supplied fact to model conjecture.
const EVIDENCE_TONE: Record<EvidenceType, string> = {
  fact: "border-teal/40 bg-teal/[0.08] text-teal",
  estimate: "border-iris/40 bg-iris/[0.08] text-iris",
  assumption: "border-line bg-night text-muted",
  ai_hypothesis: "border-violet/40 bg-violet/[0.08] text-violet",
};

function Scale({ label, value }: { label: string; value: number }) {
  const tone =
    value >= 5
      ? "bg-risk-critical"
      : value >= 4
        ? "bg-risk-high"
        : value >= 3
          ? "bg-risk-moderate"
          : "bg-risk-low";
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <span className="w-[5.5rem] sm:w-auto">{label}</span>
      <span
        className="flex gap-0.5"
        role="img"
        aria-label={`${label} ${value}/5`}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`h-2.5 w-1.5 rounded-sm ${i <= value ? tone : "bg-line"}`}
          />
        ))}
      </span>
      <span className="tabular-nums text-ink">{value}/5</span>
    </span>
  );
}

const AUDIT_TONE = {
  supported: "border-teal/40 text-teal",
  weak: "border-risk-moderate/40 text-risk-moderate",
  unsupported: "border-risk-critical/40 text-risk-critical",
} as const;

type Target = { orgId: string; decisionId: string } | null;

function FindingItem({
  d,
  f,
  target,
  explainBase,
}: {
  d: D;
  f: Finding;
  target: Target;
  explainBase?: string;
}) {
  const R = d.results;
  const excluded = f.audit_status === "unsupported";
  return (
    <li
      id={`finding-${f.id}`}
      className={`scroll-mt-24 border-t border-line py-4 first:border-t-0 first:pt-0 last:pb-0 target:rounded-lg target:bg-electric/[0.08] target:ring-1 target:ring-electric/40 ${excluded ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h4 className="min-w-0 text-sm font-semibold text-ink">{f.title}</h4>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${EVIDENCE_TONE[f.evidence_type]}`}
        >
          {R.evidence[f.evidence_type]}
        </span>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-ink/85">
        {f.description}
      </p>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5">
        <Scale label={R.likelihood} value={f.likelihood} />
        <Scale label={R.impact} value={f.impact} />
      </div>
      <dl className="mt-3 grid gap-1.5 text-xs leading-relaxed sm:grid-cols-[7rem_minmax(0,1fr)]">
        <dt className="text-muted">{R.basis}</dt>
        <dd className="text-ink/80">{f.basis}</dd>
        <dt className="text-muted">{R.mitigation}</dt>
        <dd className="text-ink/80">{f.mitigation}</dd>
      </dl>
      <p className="mt-3 flex flex-wrap items-start gap-2 text-xs leading-relaxed">
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
            f.audit_status
              ? AUDIT_TONE[f.audit_status]
              : "border-line text-muted"
          }`}
        >
          <ShieldCheck className="size-3" aria-hidden />
          {f.audit_status ? d.audit.verdict[f.audit_status] : d.audit.none}
        </span>
        {f.audit_note && <span className="text-muted">{f.audit_note}</span>}
        {excluded && (
          <span className="text-risk-critical">· {d.audit.excluded}</span>
        )}
      </p>
      {((target && !excluded) || explainBase) && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {explainBase && (
            <Link
              href={`${explainBase}&ask=${encodeURIComponent(fmt(d.help.explainQuestion, { title: f.title }))}`}
              className="inline-flex items-center gap-1 rounded-full border border-teal/30 px-2 py-0.5 text-[11px] text-teal transition-colors hover:bg-teal/10"
            >
              <MessageCircleQuestion className="size-3" aria-hidden />
              {d.help.explain}
            </Link>
          )}
          {target && !excluded && (
            <CreateActionButton
              d={d}
              orgId={target.orgId}
              decisionId={target.decisionId}
              findingId={f.id}
              title={f.mitigation}
            />
          )}
        </div>
      )}
    </li>
  );
}

function AgentCard({
  d,
  run,
  target,
  explainBase,
}: {
  d: D;
  run: AgentRun;
  target: Target;
  explainBase?: string;
}) {
  const R = d.results;
  const name = (R.agents as Record<string, string>)[run.agent] ?? run.agent;
  return (
    <article className="rounded-2xl border border-line bg-abyss/70 p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-medium text-ink">{name}</h3>
        {run.confidence && (
          <span className="text-xs text-muted">
            {fmt(R.confidence, { level: R.levels[run.confidence] })}
          </span>
        )}
      </header>
      {run.status === "failed" ? (
        <p className="mt-3 flex gap-2 text-sm text-muted">
          <CircleAlert
            className="mt-0.5 size-4 shrink-0 text-risk-high"
            aria-hidden
          />
          {fmt(R.agentFailed, { code: run.error_code ?? "error" })}
        </p>
      ) : (
        <>
          {run.summary && (
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {run.summary}
            </p>
          )}
          {run.findings.length > 0 ? (
            <ul className="mt-5">
              {run.findings.map((f) => (
                <FindingItem
                  key={f.id}
                  d={d}
                  f={f}
                  target={target}
                  explainBase={explainBase}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">{R.noFindings}</p>
          )}
          {run.missing_information.length > 0 && (
            <div className="mt-5 rounded-xl border border-line bg-night px-4 py-3">
              <p className="text-xs font-medium text-ink">{R.missing}</p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs text-muted">
                {run.missing_information.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </article>
  );
}

/** Findings of a completed analysis, one card per specialist agent. */
export function AgentResults({
  d,
  analysis,
  target = null,
  explainBase,
}: {
  d: D;
  analysis: Analysis;
  /** When set, each finding offers "Create an action" on this decision. */
  target?: Target;
  /** Questions page for this dossier: each finding offers "Explain this risk". */
  explainBase?: string;
}) {
  const R = d.results;
  if (analysis.status !== "completed" || analysis.agents.length === 0)
    return null;
  const audit = analysis.agents.find((r) => r.agent === "audit") ?? null;
  const specialists = analysis.agents.filter((r) => r.agent !== "audit");
  const all = specialists.flatMap((r) => r.findings);
  const count = (v: string) => all.filter((f) => f.audit_status === v).length;
  return (
    <section aria-labelledby="agent-results" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="agent-results" className="font-semibold text-ink">
          {R.title}
        </h2>
        {analysis.model && !analysis.simulated && (
          <span className="text-xs text-muted">
            {fmt(R.producedBy, { model: analysis.model })}
          </span>
        )}
      </div>
      {analysis.simulated && (
        <div className="flex gap-3 rounded-xl border border-risk-moderate/40 bg-risk-moderate/[0.08] px-4 py-3 text-sm leading-relaxed text-ink">
          <FlaskConical
            className="mt-0.5 size-4 shrink-0 text-risk-moderate"
            aria-hidden
          />
          <p>
            <strong className="font-semibold">{R.simulatedTitle}.</strong>{" "}
            {R.simulatedBody}
          </p>
        </div>
      )}
      <HowToRead label={d.help.label} text={d.help.finding} />
      {audit && (
        <div className="flex gap-3 rounded-xl border border-line bg-abyss/70 px-4 py-3 text-sm leading-relaxed">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-teal"
            aria-hidden
          />
          <div>
            <p className="font-medium text-ink">
              {d.audit.title}
              {audit.status === "completed" && (
                <span className="ml-2 font-normal text-muted">
                  {fmt(d.audit.counts, {
                    s: String(count("supported")),
                    w: String(count("weak")),
                    u: String(count("unsupported")),
                  })}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-muted">
              {audit.status === "completed"
                ? audit.summary
                : fmt(d.audit.failed, { code: audit.error_code ?? "error" })}
            </p>
          </div>
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-3">
        {specialists.map((run) => (
          <AgentCard
            key={run.agent}
            d={d}
            run={run}
            target={target}
            explainBase={explainBase}
          />
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted">{R.scaleNote}</p>
    </section>
  );
}
