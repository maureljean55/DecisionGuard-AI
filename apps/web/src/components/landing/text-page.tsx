import type { ReactNode } from "react";

import { container } from "./sections";

type Section = { h: string; p: string[] };

/** Highlights "[à compléter]" markers so missing legal details are obvious, never hidden. */
function withPlaceholders(text: string, marker: string): ReactNode {
  if (!text.includes(marker)) return text;
  const parts = text.split(marker);
  return parts.flatMap((part, i) =>
    i < parts.length - 1
      ? [
          part,
          <mark key={i} className="rounded bg-risk-moderate/15 px-1 text-risk-moderate">
            {marker}
          </mark>,
        ]
      : [part],
  );
}

export function TextSections({
  sections,
  updated,
  marker,
}: {
  sections: Section[];
  updated?: string;
  marker: string;
}) {
  return (
    <div className={`${container} py-12`}>
      <div className="max-w-3xl space-y-10">
        {sections.map((s) => (
          <section key={s.h}>
            <h2 className="font-display text-2xl font-semibold text-ink">{s.h}</h2>
            <div className="mt-3 space-y-3 text-[0.95rem] leading-relaxed text-muted">
              {s.p.map((p) => (
                <p key={p}>{withPlaceholders(p, marker)}</p>
              ))}
            </div>
          </section>
        ))}
        {updated && <p className="border-t border-line pt-6 text-xs text-muted">{updated}</p>}
      </div>
    </div>
  );
}
