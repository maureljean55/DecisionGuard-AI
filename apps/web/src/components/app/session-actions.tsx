"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { api } from "@/lib/client-api";

export function LogoutButton({ label, lang }: { label: string; lang: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await api("/auth/logout", { method: "POST" });
        } finally {
          router.replace(`/${lang}/login`);
          router.refresh();
        }
      }}
      className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-ink hover:bg-bg disabled:opacity-60"
    >
      <LogOut className="size-4" aria-hidden />
      {label}
    </button>
  );
}

export function ResendVerification({ label, doneLabel }: { label: string; doneLabel: string }) {
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  if (state === "done") return <span className="text-sm font-medium">{doneLabel}</span>;
  return (
    <button
      type="button"
      disabled={state === "pending"}
      onClick={async () => {
        setState("pending");
        try {
          await api("/auth/verify-email/resend", { method: "POST" });
          setState("done");
        } catch {
          setState("idle");
        }
      }}
      className="text-sm font-medium underline underline-offset-2 disabled:opacity-60"
    >
      {label}
    </button>
  );
}
