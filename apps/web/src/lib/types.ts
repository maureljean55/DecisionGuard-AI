/** Types mirroring the API schemas (apps/api/app/auth/schemas.py, app/orgs/schemas.py). */

export type Role = "owner" | "admin" | "analyst" | "viewer";

export interface User {
  id: string;
  email: string;
  full_name: string;
  locale: "fr" | "en";
  email_verified: boolean;
}

export interface Membership {
  organization: { id: string; name: string; slug: string };
  role: Role;
}

export interface Me {
  user: User;
  memberships: Membership[];
}

export interface InvitationPreview {
  organization_name: string;
  email: string;
  role: Role;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
