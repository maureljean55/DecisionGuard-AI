import type { ReactNode } from "react";

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[2rem] font-medium leading-tight text-ink sm:text-[2.4rem]">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div>
      <div className="h-9 w-72 animate-pulse rounded-lg bg-line" />
      <div className="mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-line/70" />
      <div className="mt-8 h-64 animate-pulse rounded-2xl bg-line/50" />
    </div>
  );
}
