export function AuthHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <h1 className="font-display text-[2rem] font-medium leading-tight text-ink">{title}</h1>
      {subtitle && <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>}
    </div>
  );
}
