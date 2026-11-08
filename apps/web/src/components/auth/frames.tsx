/**
 * Page frames for the authentication area. Sign-in and sign-up deliberately look different:
 * - sign-in: a returning user, the owl welcomes them back (owl panel left, short form right);
 * - sign-up: a discovery page, mirrored (form left, "what to expect" panel right, teal mood);
 * - other pages (password, e-mail, invitation): a single centred card.
 */
import { Check, Lock, MapPin } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import type { Dictionary } from "@/i18n/dictionaries";

const card =
  "w-full rounded-3xl border border-line bg-abyss/70 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)] sm:p-9";

export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 items-start justify-center px-4 pb-14 pt-6 sm:items-center">
      <div className={`${card} max-w-md`}>{children}</div>
    </div>
  );
}

export function LoginFrame({
  dict,
  children,
}: {
  dict: Dictionary;
  children: ReactNode;
}) {
  const P = dict.auth.loginPanel;
  const NOTE_ICONS = [Lock, MapPin];
  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 pb-14 pt-6 sm:px-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16 lg:px-8">
      {/* Welcome panel (desktop): the owl keeps watch. */}
      <section className="relative isolate hidden text-center lg:block">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 -z-10 mx-auto h-[420px] max-w-[520px] rounded-full bg-iris/20 blur-[90px]"
        />
        <Image
          src="/brand/owl-emblem-480.png"
          alt=""
          width={480}
          height={324}
          priority
          className="mx-auto h-auto w-[82%] max-w-[440px] drop-shadow-[0_24px_60px_rgba(91,108,255,0.35)]"
        />
        <h2 className="mt-10 font-display text-[2.6rem] font-medium leading-tight text-ink">
          {P.title}
        </h2>
        <p className="mx-auto mt-3 max-w-md leading-relaxed text-muted">
          {P.body}
        </p>
        <ul className="mt-7 flex justify-center gap-3">
          {P.notes.map((n, i) => {
            const Icon = NOTE_ICONS[i];
            return (
              <li
                key={n}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-abyss/60 px-3 py-1.5 text-xs text-ink/85"
              >
                <Icon className="size-3.5 text-teal" aria-hidden />
                {n}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mx-auto w-full max-w-md">
        {/* Mobile: a small owl and the welcome line, so sign-in stays recognisable. */}
        <div className="mb-6 text-center lg:hidden">
          <Image
            src="/brand/owl-emblem-480.png"
            alt=""
            width={480}
            height={324}
            priority
            className="mx-auto h-auto w-40 drop-shadow-[0_16px_40px_rgba(91,108,255,0.35)]"
          />
          <p className="mt-4 font-display text-2xl text-ink">{P.title}</p>
        </div>
        <div className={card}>{children}</div>
      </div>
    </div>
  );
}

export function RegisterFrame({
  dict,
  children,
}: {
  dict: Dictionary;
  children: ReactNode;
}) {
  const P = dict.auth.registerPanel;
  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-10 px-4 pb-14 pt-6 sm:px-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-14 lg:px-8">
      <div className={`${card} mx-auto max-w-xl`}>{children}</div>

      {/* "What to expect" panel: a true sequence, so the steps are numbered. */}
      <aside className="relative isolate overflow-hidden rounded-3xl border border-teal/25 bg-gradient-to-br from-teal/[0.10] via-abyss to-abyss p-7 sm:p-9 lg:sticky lg:top-24">
        <div
          aria-hidden
          className="absolute -right-24 -top-24 -z-10 size-72 rounded-full bg-teal/15 blur-[80px]"
        />
        <p className="text-sm font-medium text-teal">{P.eyebrow}</p>
        <h2 className="mt-3 font-display text-[2.2rem] font-medium leading-tight text-ink">
          {P.title}
        </h2>
        <ol className="mt-8 space-y-6">
          {P.steps.map((s, i) => (
            <li key={s.t} className="relative flex gap-4">
              {i < P.steps.length - 1 && (
                <span
                  aria-hidden
                  className="absolute left-[1.05rem] top-10 h-[calc(100%-1rem)] w-px bg-teal/25"
                />
              )}
              <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border border-teal/50 bg-night font-mono text-sm text-teal">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold text-ink">{s.t}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.b}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-8 flex gap-2.5 border-t border-line pt-6 text-sm leading-relaxed text-ink/80">
          <Check className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
          {P.trust}
        </p>
      </aside>
    </div>
  );
}
