import "server-only";

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
