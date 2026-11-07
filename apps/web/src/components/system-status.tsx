import type { Dictionary } from "@/i18n/dictionaries";
import { fetchHealth } from "@/lib/api";

const tone = {
  ok: "bg-emerald-500",
  degraded: "bg-amber-500",
  unreachable: "bg-rose-500",
} as const;

export async function SystemStatus({ dict }: { dict: Dictionary["status"] }) {
  const status = await fetchHealth();
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted" role="status">
      <span className={`size-2 rounded-full ${tone[status]}`} aria-hidden />
      {dict.label} : {dict[status]}
    </span>
  );
}

export function SystemStatusFallback() {
  return <span className="inline-block h-4 w-40 animate-pulse rounded bg-line" />;
}
