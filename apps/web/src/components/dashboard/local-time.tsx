"use client";

import { useSyncExternalStore } from "react";

import { formatDate } from "@/lib/dash-format";

const noop = () => () => {};

/**
 * A date in the visitor's own time zone (Douala, Dakar, Paris…). The server and the first
 * client render use UTC so hydration matches; the browser then switches to local time.
 */
export function LocalTime({
  iso,
  lang,
  withTime = false,
}: {
  iso: string;
  lang: string;
  withTime?: boolean;
}) {
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  return (
    <time dateTime={iso}>
      {formatDate(iso, lang, withTime, mounted ? undefined : "UTC")}
    </time>
  );
}
