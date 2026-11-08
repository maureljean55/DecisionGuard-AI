import Image from "next/image";
import Link from "next/link";

/** Shown for unknown pages and for organisations you do not belong to (never reveals which). */
export default function NotFound() {
  return (
    <div className="theme-night flex min-h-[70vh] flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <Image src="/brand/owl-emblem-480.png" alt="" width={480} height={324} className="h-auto w-36 opacity-90" />
      <p className="mt-8 font-mono text-sm text-teal">404</p>
      <h1 className="mt-2 font-display text-3xl text-ink">Page introuvable · Page not found</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
        Cette page n&apos;existe pas ou vous n&apos;y avez pas accès. · This page does not exist or you do not have access to it.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/fr" className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-night hover:bg-white">
          Accueil
        </Link>
        <Link href="/en" className="rounded-full border border-line px-5 py-2.5 text-sm text-ink hover:bg-white/[0.05]">
          Home
        </Link>
      </div>
    </div>
  );
}
