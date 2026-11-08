/**
 * Severity of a finding as the agents assessed it: likelihood × impact, each 1–5.
 * This is not the deterministic risk score (M6); the UI says so wherever it is shown.
 */
import type { Finding } from "@/lib/types";

export type Level = "low" | "moderate" | "high" | "critical";

export const severity = (f: Pick<Finding, "likelihood" | "impact">) =>
  f.likelihood * f.impact;

export function level(score: number): Level {
  if (score >= 15) return "critical";
  if (score >= 10) return "high";
  if (score >= 5) return "moderate";
  return "low";
}

export const LEVEL_TEXT: Record<Level, string> = {
  low: "text-risk-low",
  moderate: "text-risk-moderate",
  high: "text-risk-high",
  critical: "text-risk-critical",
};

export const LEVEL_CHIP: Record<Level, string> = {
  low: "border-risk-low/40 bg-risk-low/10 text-risk-low",
  moderate: "border-risk-moderate/40 bg-risk-moderate/10 text-risk-moderate",
  high: "border-risk-high/40 bg-risk-high/10 text-risk-high",
  critical: "border-risk-critical/40 bg-risk-critical/10 text-risk-critical",
};

export const LEVEL_FILL: Record<Level, string> = {
  low: "bg-risk-low",
  moderate: "bg-risk-moderate",
  high: "bg-risk-high",
  critical: "bg-risk-critical",
};

/** A finding that deserves attention on the cockpit. */
export const MAJOR = 15;
export const ALERT = 12;
