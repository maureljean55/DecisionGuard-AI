import "server-only";

import { notFound, redirect } from "next/navigation";

import { apiGet } from "./api";
import type { Organization } from "./types";

/** Load an organisation the current user belongs to, or 404 (never reveals other tenants). */
export async function loadOrg(
  lang: string,
  orgId: string,
): Promise<Organization> {
  const { status, data } = await apiGet<Organization>(
    `/orgs/${encodeURIComponent(orgId)}`,
  );
  if (status === 401) redirect(`/${lang}/login`);
  if (!data) notFound();
  return data;
}
