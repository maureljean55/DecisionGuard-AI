import "server-only";

import { cookies } from "next/headers";

import type { Me } from "./types";

/** Base URL of the DecisionGuard API, as seen from the Next.js server. */
export const API_URL = process.env.API_URL ?? "http://localhost:8000";

export type HealthStatus = "ok" | "degraded" | "unreachable";

export interface HealthResponse {
  status: "ok" | "degraded";
  environment: string;
  checks: Record<string, "ok" | "error">;
}

export async function fetchHealth(): Promise<HealthStatus> {
  try {
    const res = await fetch(`${API_URL}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    // /health returns 503 with a valid body when degraded.
    const body = (await res.json()) as HealthResponse;
    return body.status;
  } catch {
    return "unreachable";
  }
}

/** Current user, resolved server-side from the session cookie. null if signed out. */
export async function getMe(): Promise<Me | null> {
  const jar = await cookies();
  const session = jar.get("dg_session");
  if (!session) return null;
  try {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: { cookie: `dg_session=${session.value}` },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return (await res.json()) as Me;
  } catch {
    return null;
  }
}
