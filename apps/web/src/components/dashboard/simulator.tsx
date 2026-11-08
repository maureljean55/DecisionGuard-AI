"use client";

/** Interactive scenario simulator: shifts the agents' estimates and asks the API to recompute. */
import { Loader2, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { Dictionary } from "@/i18n/dictionaries";
import { api } from "@/lib/client-api";
import { fmt } from "@/lib/format";
import { LEVEL_TEXT } from "@/lib/risk";
import type { RiskBreakdown, RiskLevel, Scenario } from "@/lib/types";

import { ctaGhost, Plate } from "./cockpit";
import { Heatmap, RiskIndex } from "./risk";

type D = Dictionary["dash"];
type Shift = { likelihood: number; impact: number };
const ZERO: Shift = { likelihood: 0, impact: 0 };
type Result = RiskBreakdown & { baseline: number };

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted">{label}</span>
      <span className="inline-flex items-center rounded-lg border border-line bg-night/60">
        <button
          type="button"
          aria-label={`${label} −1`}
          disabled={value <= -2}
          onClick={() => onChange(value - 1)}
          className="size-8 text-muted hover:text-ink disabled:opacity-30"
        >
          −
        </button>
        <span
          className={`w-8 text-center font-mono text-sm tabular-nums ${value > 0 ? "text-risk-high" : value < 0 ? "text-teal" : "text-ink"}`}
          aria-live="polite"
        >
          {value > 0 ? `+${value}` : value}
        </span>
        <button
          type="button"
          aria-label={`${label} +1`}
          disabled={value >= 2}
          onClick={() => onChange(value + 1)}
          className="size-8 text-muted hover:text-ink disabled:opacity-30"
        >
          +
        </button>
      </span>
    </div>
  );
}

export function SimulatorPanel({
  d,
  orgId,
  analysisId,
  baseline,
  baselineLevel,
  breakdown,
  scenarios,
  agents,
}: {
  d: D;
  orgId: string;
  analysisId: string;
  baseline: number;
  baselineLevel: RiskLevel;
  breakdown: RiskBreakdown;
  scenarios: Scenario[];
  agents: string[];
}) {
  const S = d.simulator;
  const [all, setAll] = useState<Shift>(ZERO);
  const [per, setPer] = useState<Record<string, Shift>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const untouched =
    all.likelihood === 0 &&
    all.impact === 0 &&
    Object.values(per).every((s) => s.likelihood === 0 && s.impact === 0);
  const body = useMemo(() => ({ all, agents: per }), [all, per]);

  // Recompute after a short pause, so repeated clicks send one request.
  useEffect(() => {
    if (untouched) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setBusy(true);
      setError(false);
      try {
        const r = await api<Result>(
          `/orgs/${orgId}/analyses/${analysisId}/simulate`,
          { body },
        );
        if (!cancelled) setResult(r);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [body, untouched, orgId, analysisId]);

  const shown: RiskBreakdown = untouched || !result ? breakdown : result;
  const delta = shown.score - baseline;
  const reset = () => {
    setAll(ZERO);
    setPer({});
    setResult(null);
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <Plate className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
            {S.all}
          </p>
          <button
            type="button"
            onClick={reset}
            className={`${ctaGhost} py-1.5`}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            {S.reset}
          </button>
        </div>
        <div className="mt-3 space-y-2.5">
          <Stepper
            label={S.likelihood}
            value={all.likelihood}
            onChange={(v) => setAll((x) => ({ ...x, likelihood: v }))}
          />
          <Stepper
            label={S.impact}
            value={all.impact}
            onChange={(v) => setAll((x) => ({ ...x, impact: v }))}
          />
        </div>

        <p className="mt-6 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
          {S.byAgent}
        </p>
        <ul className="mt-3 space-y-4">
          {agents.map((a) => {
            const sh = per[a] ?? ZERO;
            const set = (k: keyof Shift) => (v: number) =>
              setPer((x) => ({ ...x, [a]: { ...(x[a] ?? ZERO), [k]: v } }));
            return (
              <li
                key={a}
                className="rounded-xl border border-line bg-white/[0.02] p-3"
              >
                <p className="mb-2 text-sm font-medium text-ink">
                  {d.agentCatalog[a as keyof typeof d.agentCatalog]?.name ?? a}
                </p>
                <div className="space-y-2">
                  <Stepper
                    label={S.likelihood}
                    value={sh.likelihood}
                    onChange={set("likelihood")}
                  />
                  <Stepper
                    label={S.impact}
                    value={sh.impact}
                    onChange={set("impact")}
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-muted">{S.help}</p>

        <p className="mt-6 font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
          {S.presets}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {scenarios.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setPer({});
                setAll({
                  likelihood: s.likelihood_shift,
                  impact: s.impact_shift,
                });
              }}
              className={`${ctaGhost} py-1.5 text-xs`}
            >
              {d.risk.scenario[s.key]}
              <span className={`font-mono ${LEVEL_TEXT[s.level]}`}>
                {s.score}
              </span>
            </button>
          ))}
        </div>
      </Plate>

      <Plate className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.12em] text-muted">
            {untouched ? S.baseline : S.simulated}
          </p>
          <span className="flex items-center gap-2 text-xs text-muted">
            {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {busy ? S.computing : null}
            {!untouched && !busy && result && (
              <span
                className={`rounded-md border border-line px-2 py-0.5 font-mono ${delta > 0 ? "text-risk-high" : delta < 0 ? "text-teal" : "text-muted"}`}
              >
                {fmt(S.delta, { d: delta > 0 ? `+${delta}` : String(delta) })}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              {S.baseline}
              <span className={`font-mono ${LEVEL_TEXT[baselineLevel]}`}>
                {baseline}
              </span>
            </span>
          </span>
        </div>
        {error && (
          <p role="alert" className="mt-3 text-sm text-risk-critical">
            {S.error}
          </p>
        )}
        <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <RiskIndex
            d={d}
            score={shown.score}
            levelKey={shown.level}
            breakdown={shown}
          />
          <Heatmap d={d} matrix={shown.matrix} />
        </div>
      </Plate>
    </div>
  );
}
