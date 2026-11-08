"use client";

/** Small building blocks shared by the dashboard pages. */
import { Loader2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import type { Role } from "@/lib/types";

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    (
      (parts[0]?.[0] ?? "") +
      (parts.length > 1 ? parts[parts.length - 1][0] : "")
    ).toUpperCase() || "?"
  );
}

export function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md";
}) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full border border-teal/30 bg-gradient-to-br from-teal/25 to-iris/25 font-semibold text-ink ${
        size === "sm" ? "size-7 text-[0.65rem]" : "size-9 text-xs"
      }`}
    >
      {initials(name)}
    </span>
  );
}

const ROLE_STYLE: Record<Role, string> = {
  owner: "border-violet/40 text-violet",
  admin: "border-iris/50 text-[#9aa6ff]",
  analyst: "border-teal/40 text-teal",
  viewer: "border-white/15 text-muted",
};

export function RoleBadge({ role, label }: { role: Role; label: string }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[0.7rem] font-medium ${ROLE_STYLE[role]}`}
    >
      {label}
    </span>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-abyss/70">
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            {title && <h2 className="font-semibold text-ink">{title}</h2>}
            {description && (
              <p className="mt-0.5 text-sm text-muted">{description}</p>
            )}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-night transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60";
export const buttonGhost =
  "inline-flex items-center justify-center gap-2 rounded-full border border-line px-3.5 py-2 text-sm text-ink transition-colors hover:bg-white/[0.05] disabled:opacity-60";
export const buttonDanger =
  "inline-flex items-center justify-center gap-2 rounded-full border border-risk-critical/40 px-3.5 py-2 text-sm text-risk-critical transition-colors hover:bg-risk-critical/10 disabled:opacity-60";

/** Button that asks for confirmation in a native modal dialog before running `onConfirm`. */
export function ConfirmButton({
  label,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  className = buttonDanger,
}: {
  label: ReactNode;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => Promise<void>;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, setPending] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => ref.current?.showModal()}
      >
        {label}
      </button>
      <dialog
        ref={ref}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-abyss p-0 text-ink backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="p-6">
          <p className="leading-relaxed">{message}</p>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className={buttonGhost}
              onClick={() => ref.current?.close()}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={buttonDanger}
              disabled={pending}
              onClick={async () => {
                setPending(true);
                try {
                  await onConfirm();
                  ref.current?.close();
                } finally {
                  setPending(false);
                }
              }}
            >
              {pending && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              {confirmLabel}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

export { formatDate } from "@/lib/dash-format";
