import { describe, expect, it } from "vitest";

import {
  assignableRoles,
  canManageMember,
  canManageMembers,
} from "./permissions";

describe("permissions (UI mirror of the API rules)", () => {
  it("owners can assign every role, admins all but owner, others none", () => {
    expect(assignableRoles("owner")).toEqual([
      "owner",
      "admin",
      "analyst",
      "viewer",
    ]);
    expect(assignableRoles("admin")).toEqual(["admin", "analyst", "viewer"]);
    expect(assignableRoles("analyst")).toEqual([]);
    expect(assignableRoles("viewer")).toEqual([]);
  });

  it("admins cannot touch owners", () => {
    expect(canManageMember("admin", "owner")).toBe(false);
    expect(canManageMember("admin", "analyst")).toBe(true);
    expect(canManageMember("owner", "owner")).toBe(true);
    expect(canManageMember("analyst", "viewer")).toBe(false);
  });

  it("only owners and admins manage members", () => {
    expect(canManageMembers("owner") && canManageMembers("admin")).toBe(true);
    expect(canManageMembers("analyst") || canManageMembers("viewer")).toBe(
      false,
    );
  });
});
