"use client";

import { useState } from "react";

import { ApiError } from "./client-api";

/** Turn thrown API errors into a user-facing message (already localized by the API). */
export function useApiError(networkMessage: string) {
  const [error, setError] = useState<string | null>(null);
  const capture = (err: unknown) => {
    if (err instanceof ApiError && err.message) setError(err.message);
    else setError(networkMessage);
  };
  return { error, setError, capture };
}
