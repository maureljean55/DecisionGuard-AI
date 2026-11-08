/** Pure formatting helpers for the dashboard, usable from server and client components. */
import type { Dictionary } from "@/i18n/dictionaries";

import { fmt } from "./format";
import type { AuditEntry } from "./types";

export function formatDate(
  iso: string,
  lang: string,
  withTime = false,
): string {
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(iso));
}

export function describeAction(d: Dictionary["dash"], e: AuditEntry): string {
  const known = d.activity.actions as Record<string, string>;
  return known[e.action] ?? fmt(d.activity.other, { code: e.action });
}
