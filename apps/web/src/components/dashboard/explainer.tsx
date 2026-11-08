import { Check } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

/** Honest empty state for modules that are not live yet: what will appear here, and why not yet. */
export function ModuleEmpty({
  icon: Icon,
  title,
  body,
  whatTitle,
  what,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
  whatTitle: string;
  what: string[];
  children?: ReactNode;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl border border-line bg-abyss">
          <Icon className="size-5 text-muted" />
        </span>
        <p className="mt-4 font-medium text-ink">{title}</p>
        <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
          {body}
        </p>
        {children}
      </div>
      <section className="rounded-2xl border border-line bg-abyss/70 p-5">
        <h2 className="font-semibold text-ink">{whatTitle}</h2>
        <ul className="mt-4 space-y-3">
          {what.map((w) => (
            <li
              key={w}
              className="flex gap-2.5 text-sm leading-relaxed text-ink/85"
            >
              <Check className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
              {w}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
