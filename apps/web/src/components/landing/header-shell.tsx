"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Floating header bar: translucent at the top of the page, more opaque with a soft shadow
 * once the page has scrolled.
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    const frame = requestAnimationFrame(onScroll); // initial state (e.g. reload mid-page)
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
      <div
        data-scrolled={scrolled}
        className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 rounded-full border border-white/[0.08] bg-night/60 pl-4 pr-2 backdrop-blur-xl transition-[background-color,box-shadow,border-color] duration-300 data-[scrolled=true]:border-white/[0.12] data-[scrolled=true]:bg-night/85 data-[scrolled=true]:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.7)] sm:pl-5"
      >
        {children}
      </div>
    </header>
  );
}
