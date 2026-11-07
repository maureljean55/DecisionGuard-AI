"use client";

/**
 * "How it works": a five-stage pipeline. Each stage has its own small illustration, and the
 * stages light up one after the other along a progress line when the section comes into view.
 * Server-rendered fully visible; the reveal is only armed once JavaScript runs and the section
 * is still off-screen. Respects prefers-reduced-motion.
 */
import { Check, FileText, RotateCcw, ShieldCheck } from "lucide-react";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import type { Dictionary } from "@/i18n/dictionaries";

type How = Dictionary["landing"]["how"];

const STEP_DELAY = 0.28; // seconds between two stages

const level = (s: number) =>
  s >= 17
    ? "bg-risk-critical/70"
    : s >= 10
      ? "bg-risk-high/55"
      : s >= 5
        ? "bg-risk-moderate/40"
        : "bg-risk-low/35";

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[7.5rem] flex-col justify-center rounded-lg border border-line bg-night px-3.5 py-3">
      {children}
    </div>
  );
}

function DecisionVisual({ d }: { d: How["demo"] }) {
  return (
    <Frame>
      <div className="rounded-md border border-white/10 bg-abyss px-3 py-2.5">
        <p className="text-[0.8rem] leading-snug text-ink">
          {d.input}
          <span
            className="ml-0.5 inline-block h-3.5 w-px translate-y-0.5 animate-pulse bg-teal"
            aria-hidden
          />
        </p>
      </div>
      <p className="mt-2 font-mono text-[0.65rem] text-muted">{d.inputMeta}</p>
    </Frame>
  );
}

function AgentsVisual({ d }: { d: How["demo"] }) {
  return (
    <Frame>
      <ul className="flex flex-wrap gap-1.5">
        {d.agents.map((a) => (
          <li
            key={a}
            className="rounded-full border border-line bg-abyss px-2 py-0.5 text-[0.68rem] text-ink/90"
          >
            {a}
          </li>
        ))}
      </ul>
    </Frame>
  );
}

function ScoreVisual({ d }: { d: How["demo"] }) {
  return (
    <Frame>
      <div className="flex items-center gap-4">
        <div className="grid shrink-0 grid-cols-5 gap-[2px]" aria-hidden>
          {[5, 4, 3, 2, 1].flatMap((p) =>
            [1, 2, 3, 4, 5].map((i) => (
              <span
                key={`${p}${i}`}
                className={`size-3 rounded-[2px] ${level(p * i)} ${p === 4 && i === 4 ? "ring-1 ring-ink" : ""}`}
              />
            )),
          )}
        </div>
        <div className="font-mono">
          <p className="text-[0.7rem] text-muted">{d.formula}</p>
          <p className="mt-0.5 text-lg text-ink">
            4×4=<span className="text-risk-high">16</span>
          </p>
        </div>
      </div>
    </Frame>
  );
}

function AuditVisual({ d }: { d: How["demo"] }) {
  return (
    <Frame>
      <ul className="space-y-1.5">
        {d.checks.map((c) => (
          <li
            key={c}
            className="flex items-center gap-2 text-[0.72rem] text-ink/90"
          >
            <Check className="size-3.5 shrink-0 text-teal" aria-hidden />
            {c}
          </li>
        ))}
      </ul>
      <p className="mt-2 inline-flex w-fit items-center gap-1 rounded-full border border-dashed border-teal/50 px-2 py-0.5 text-[0.65rem] text-teal">
        <RotateCcw className="size-3" aria-hidden />
        {d.loop}
      </p>
    </Frame>
  );
}

function ReportVisual({ d }: { d: How["demo"] }) {
  return (
    <Frame>
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[0.72rem] font-medium text-ink">
          <FileText className="size-3.5 text-muted" aria-hidden />
          {d.report}
        </p>
        <span className="inline-flex items-center gap-1 rounded-full border border-teal/50 bg-teal/10 px-1.5 py-0.5 text-[0.6rem] text-teal">
          <ShieldCheck className="size-3" aria-hidden />
          {d.seal}
        </span>
      </div>
      <div className="mt-3 space-y-1.5" aria-hidden>
        {[
          ["w-[85%]", "bg-risk-critical/70"],
          ["w-[65%]", "bg-risk-high/60"],
          ["w-[45%]", "bg-risk-moderate/50"],
        ].map(([w, c]) => (
          <div key={w} className="flex items-center gap-2">
            <span className={`h-1.5 rounded-full ${c} ${w}`} />
          </div>
        ))}
      </div>
    </Frame>
  );
}

const VISUALS = [
  DecisionVisual,
  AgentsVisual,
  ScoreVisual,
  AuditVisual,
  ReportVisual,
];

export function HowItWorks({ h }: { h: How }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.85) {
      el.dataset.reveal = "on"; // already visible: play right away
      return;
    }
    el.dataset.reveal = "ready"; // armed: hidden until it scrolls into view
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.dataset.reveal = "on";
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const n = h.stages.length;
  return (
    <div ref={ref} className="group/how relative">
      {/* Progress line (desktop): fills from the first stage to the last. */}
      <div
        className="absolute left-[10%] right-[10%] top-[1.375rem] hidden h-px bg-line lg:block"
        aria-hidden
      >
        <div className="h-full origin-left bg-teal transition-transform duration-[1500ms] ease-out group-data-[reveal=ready]/how:scale-x-0 group-data-[reveal=ready]/how:transition-none" />
      </div>
      {/* Progress line (mobile): vertical, behind the step numbers. */}
      <div
        className="absolute bottom-6 left-[1.375rem] top-6 w-px bg-line sm:hidden"
        aria-hidden
      >
        <div className="h-full origin-top bg-teal transition-transform duration-[1500ms] ease-out group-data-[reveal=ready]/how:scale-y-0 group-data-[reveal=ready]/how:transition-none" />
      </div>

      <ol className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
        {h.stages.map((s, i) => {
          const Visual = VISUALS[i];
          const style = {
            transitionDelay: `${i * STEP_DELAY}s`,
          } as CSSProperties;
          return (
            <li key={s.title} className="flex gap-4 sm:flex-col sm:gap-0">
              <div className="flex shrink-0 justify-start sm:mb-4 lg:justify-center">
                <span
                  style={style}
                  className="relative z-10 flex size-11 items-center justify-center rounded-full border border-teal/60 bg-night font-mono text-sm text-teal transition-colors duration-500 group-data-[reveal=ready]/how:border-line group-data-[reveal=ready]/how:text-muted group-data-[reveal=ready]/how:transition-none"
                >
                  {i + 1}
                </span>
              </div>
              <article
                style={style}
                className="flex-1 rounded-xl border border-line bg-abyss/70 p-4 transition-[opacity,transform] duration-700 ease-out group-data-[reveal=ready]/how:translate-y-3 group-data-[reveal=ready]/how:opacity-0 group-data-[reveal=ready]/how:transition-none"
              >
                <Visual d={h.demo} />
                <h3 className="mt-4 font-display text-[1.3rem] font-semibold leading-tight text-ink">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {s.body}
                </p>
              </article>
              {i < n - 1 && <span className="sr-only">→</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
