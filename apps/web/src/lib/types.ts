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

export interface Organization {
  id: string;
  name: string;
  slug: string;
  country_code: string;
  currency: string;
  default_locale: "fr" | "en";
  plan: string;
  created_at: string;
  role: Role;
}

export interface Member {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: Role;
  joined_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  role: Role;
  created_at: string;
  expires_at: string;
}

export interface AuditEntry {
  id: number;
  action: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  target_type: string | null;
  target_id: string | null;
  ip: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AuditPage {
  items: AuditEntry[];
  next_before_id: number | null;
}

export interface SessionInfo {
  id: string;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  ip: string | null;
  user_agent: string | null;
  current: boolean;
}

export type DecisionCategory =
  | "strategic"
  | "financial"
  | "operational"
  | "technological"
  | "organizational"
  | "commercial"
  | "legal";
export type DecisionStatus = "draft" | "submitted" | "archived";

export interface Decision {
  id: string;
  title: string;
  description: string;
  context: string | null;
  category: DecisionCategory;
  status: DecisionStatus;
  amount: string | null;
  currency: string | null;
  deadline: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
  created_by_name: string | null;
}
