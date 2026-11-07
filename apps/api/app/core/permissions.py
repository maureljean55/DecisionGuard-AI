"""Role-based access control.

Roles are fixed per membership; permissions are derived in code so that they are versioned,
reviewed and tested with the application. (Custom roles for Enterprise plans: later milestone.)
"""

from enum import StrEnum


class Role(StrEnum):
    OWNER = "owner"
    ADMIN = "admin"
    ANALYST = "analyst"
    VIEWER = "viewer"


class Permission(StrEnum):
    ORG_READ = "org:read"
    ORG_UPDATE = "org:update"
    MEMBERS_READ = "members:read"
    MEMBERS_MANAGE = "members:manage"
    AUDIT_READ = "audit:read"
    BILLING_MANAGE = "billing:manage"
    DECISIONS_READ = "decisions:read"
    DECISIONS_WRITE = "decisions:write"
    DOCUMENTS_WRITE = "documents:write"


_VIEWER = {Permission.ORG_READ, Permission.MEMBERS_READ, Permission.DECISIONS_READ}
_ANALYST = _VIEWER | {Permission.DECISIONS_WRITE, Permission.DOCUMENTS_WRITE}
_ADMIN = _ANALYST | {Permission.ORG_UPDATE, Permission.MEMBERS_MANAGE, Permission.AUDIT_READ}
_OWNER = _ADMIN | {Permission.BILLING_MANAGE}

ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.VIEWER: frozenset(_VIEWER),
    Role.ANALYST: frozenset(_ANALYST),
    Role.ADMIN: frozenset(_ADMIN),
    Role.OWNER: frozenset(_OWNER),
}

# Higher number = more privileged. Used to prevent privilege escalation.
ROLE_RANK: dict[Role, int] = {Role.VIEWER: 0, Role.ANALYST: 1, Role.ADMIN: 2, Role.OWNER: 3}


def has_permission(role: Role, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS[role]


def can_assign_role(actor: Role, target: Role) -> bool:
    """Admins may assign up to admin; only owners may create or demote owners."""
    if actor == Role.OWNER:
        return True
    return (
        has_permission(actor, Permission.MEMBERS_MANAGE)
        and ROLE_RANK[target] < ROLE_RANK[Role.OWNER]
    )


def can_manage_member(actor: Role, target_current: Role) -> bool:
    """Whether `actor` may modify or remove a member who currently has `target_current`."""
    if actor == Role.OWNER:
        return True
    return has_permission(actor, Permission.MEMBERS_MANAGE) and target_current != Role.OWNER
