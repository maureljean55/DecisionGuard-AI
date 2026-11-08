/**
 * Same-origin relay to the DecisionGuard API.
 *
 * The browser only ever talks to the web origin: session cookies stay first-party,
 * no CORS is needed, and the API can live on a private network.
 */
import { after, type NextRequest } from "next/server";

// Room for one analysis run triggered after the response (see `kickWorker`).
export const maxDuration = 300;

const API_URL = process.env.API_URL ?? "http://localhost:8000";
// Shared with the API: lets it trust the browser IP we forward (rate limits, audit log).
const RELAY_SECRET = process.env.DG_RELAY_SECRET;
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "cookie",
  "user-agent",
  "x-csrf-token",
];
const FORWARDED_RESPONSE_HEADERS = [
  "content-type",
  "cache-control",
  "retry-after",
  "content-disposition",
];
const MAX_BODY_BYTES = 1_000_000; // JSON API; file uploads will get a dedicated path
// Writes that can queue an analysis: create/submit/update a decision, answer, retry.
const QUEUEING_WRITE = /^orgs\/[^/]+\/(decisions|analyses)(\/|$)/;

/**
 * Serverless hosting has no permanent worker: after a write that may have queued an
 * analysis, ask the API to process the queue. Runs after the response is sent.
 */
function kickWorker() {
  if (!RELAY_SECRET) return; // local dev: the Docker worker polls the queue itself
  after(async () => {
    try {
      await fetch(`${API_URL}/internal/worker/tick`, {
        method: "POST",
        headers: { "x-dg-relay-secret": RELAY_SECRET },
        cache: "no-store",
        signal: AbortSignal.timeout(295_000),
      });
    } catch {
      // The scheduled run will pick the job up later.
    }
  });
}

async function relay(request: NextRequest, ctx: RouteContext<"/api/[...path]">) {
  const { path } = await ctx.params;
  if (path.some((segment) => segment === "." || segment === ".." || segment === "")) {
    return Response.json({ error: { code: "not_found", message: "Not found" } }, { status: 404 });
  }

  const target = new URL(`${API_URL}/${path.map(encodeURIComponent).join("/")}`);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (RELAY_SECRET) {
    // On Vercel, x-forwarded-for is set by the platform edge (not spoofable by the client).
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip");
    if (ip) headers.set("x-dg-client-ip", ip);
    headers.set("x-dg-relay-secret", RELAY_SECRET);
  }

  let body: ArrayBuffer | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_BODY_BYTES) {
      return Response.json(
        { error: { code: "payload_too_large", message: "Payload too large" } },
        { status: 413 },
      );
    }
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return Response.json(
      { error: { code: "api_unreachable", message: "API unreachable" } },
      { status: 502 },
    );
  }

  const out = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  for (const cookie of upstream.headers.getSetCookie()) out.append("set-cookie", cookie);

  if (request.method !== "GET" && upstream.ok && QUEUEING_WRITE.test(path.join("/"))) {
    kickWorker();
  }

  const noBody = upstream.status === 204 || upstream.status === 304;
  return new Response(noBody ? null : upstream.body, { status: upstream.status, headers: out });
}

export { relay as DELETE, relay as GET, relay as PATCH, relay as POST, relay as PUT };
