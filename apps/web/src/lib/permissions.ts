/** Mirrors apps/api/app/core/permissions.py: the API stays the authority, this only shapes the UI. */
import type { Role } from "./types";

export const ROLES: Role[] = ["owner", "admin", "analyst", "viewer"];
const RANK: Record<Role, number> = {
  viewer: 0,
  analyst: 1,
  admin: 2,
  owner: 3,
};

export const canManageMembers = (r: Role) => r === "owner" || r === "admin";
export const canUpdateOrg = canManageMembers;
export const canReadAudit = canManageMembers;

export function assignableRoles(actor: Role): Role[] {
  if (actor === "owner") return ROLES;
  if (actor === "admin") return ROLES.filter((r) => RANK[r] < RANK.owner);
  return [];
}

export function canManageMember(actor: Role, target: Role): boolean {
  if (actor === "owner") return true;
  return actor === "admin" && target !== "owner";
}

export const canWriteDecisions = (r: Role) => r !== "viewer";
export const canDeleteDecision = (r: Role, createdBy: string | null, me: string) =>
  r === "owner" || r === "admin" || (r === "analyst" && createdBy === me);
