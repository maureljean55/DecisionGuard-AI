"use client";

/** Submit a decision again, so that every agent now in service analyses it. */
import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/form";
import { api } from "@/lib/client-api";
import { useApiError } from "@/lib/use-api-error";

import { ctaPrimary } from "./cockpit";

export function RerunButton({
  label,
  errorLabel,
  orgId,
  decisionId,
  href,
}: {
  label: string;
  errorLabel: string;
  orgId: string;
  decisionId: string;
  href: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { error, capture } = useApiError(errorLabel);
  return (
    <div className="space-y-2">
      {error && <Alert tone="error">{error}</Alert>}
      <button
        type="button"
        disabled={busy}
        className={ctaPrimary}
        onClick={async () => {
          setBusy(true);
          try {
            await api(`/orgs/${orgId}/decisions/${decisionId}/submit`, {
              method: "POST",
            });
            router.push(href);
            router.refresh();
          } catch (e) {
            capture(e);
            setBusy(false);
          }
        }}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <RefreshCw className="size-4" aria-hidden />
        )}
        {label}
      </button>
    </div>
  );
}
