"use client";

/** Drop-down listing every analysed dossier, with a search field. */
import { Check, ChevronDown, FileText, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import type { Dictionary } from "@/i18n/dictionaries";
import { LEVEL_CHIP } from "@/lib/risk";
import type { RiskLevel } from "@/lib/types";

type D = Dictionary["dash"];
export type DossierOption = {
  id: string;
  title: string;
  category: string;
  score: number | null;
  level: RiskLevel | null;
};

export function DossierPicker({
  d,
  options,
  selectedId,
  basePath,
  defaultOpen = false,
}: {
  d: D;
  options: DossierOption[];
  selectedId: string | null;
  /** Page the picker links to; the dossier id is added as ?dossier=. */
  basePath: string;
  defaultOpen?: boolean;
}) {
  const Q = d.questions;
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.id === selectedId) ?? null;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const needle = query.trim().toLocaleLowerCase();
  const shown = needle
    ? options.filter((o) => o.title.toLocaleLowerCase().includes(needle))
    : options;

  return (
    <div ref={ref} className="relative w-full max-w-2xl">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-xl border border-line bg-abyss/80 px-4 py-3 text-left transition-colors hover:border-electric/40 focus:border-electric/50 focus:outline-none focus:ring-2 focus:ring-electric/20"
      >
        <FileText className="size-4 shrink-0 text-teal" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[0.62rem] uppercase tracking-[0.12em] text-muted">
            {d.questions.dossierLabel}
          </span>
          <span className="block truncate text-sm font-medium text-ink">
            {selected ? selected.title : Q.pick}
          </span>
        </span>
        {selected?.score != null && selected.level && (
          <span
            className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[0.68rem] ${LEVEL_CHIP[selected.level]}`}
          >
            {selected.score}/100
          </span>
        )}
        <ChevronDown
          className={`size-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+0.4rem)] z-40 rounded-2xl border border-line bg-[#131d36] p-2 shadow-2xl shadow-black/60">
          {options.length > 6 && (
            <div className="relative mb-2">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <label className="sr-only" htmlFor={`${listId}-q`}>
                {Q.searchDossier}
              </label>
              <input
                id={`${listId}-q`}
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={Q.searchDossier}
                className="h-9 w-full rounded-lg border border-line bg-night/60 pl-9 pr-3 text-sm text-ink placeholder:text-muted/80 focus:border-electric/50 focus:outline-none"
              />
            </div>
          )}
          <ul id={listId} role="listbox" className="max-h-80 overflow-y-auto">
            {shown.length === 0 && (
              <li className="px-3 py-3 text-sm text-muted">
                {d.dossiers.noMatch}
              </li>
            )}
            {shown.map((o) => (
              <li key={o.id} role="option" aria-selected={o.id === selectedId}>
                <Link
                  href={`${basePath}?dossier=${o.id}`}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/[0.05] ${
                    o.id === selectedId ? "bg-electric/[0.12]" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-ink">{o.title}</span>
                    <span className="text-xs text-muted">{o.category}</span>
                  </span>
                  {o.score !== null && o.level && (
                    <span
                      className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[0.68rem] ${LEVEL_CHIP[o.level]}`}
                    >
                      {o.score}/100
                    </span>
                  )}
                  {o.id === selectedId && (
                    <Check className="size-4 shrink-0 text-teal" aria-hidden />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
