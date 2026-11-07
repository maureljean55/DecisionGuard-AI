import Image from "next/image";
import Link from "next/link";

/** Owl emblem + wordmark. The emblem is the brand's only illustration. */
export function Brand({ href, label, size = 40 }: { href: string; label: string; size?: number }) {
  return (
    <Link href={href} aria-label={label} className="group flex items-center gap-2.5">
      <Image
        src="/brand/owl-emblem-480.png"
        alt=""
        width={size * 1.48}
        height={size}
        priority
        className="h-auto transition-transform duration-300 group-hover:-translate-y-0.5"
        style={{ width: size * 1.48 }}
      />
      <span className="font-display text-[1.35rem] font-semibold leading-none tracking-tight text-ink">
        DecisionGuard <span className="text-iris">AI</span>
      </span>
    </Link>
  );
}
