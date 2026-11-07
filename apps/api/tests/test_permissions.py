import pytest

from app.core.permissions import (
    Permission,
    Role,
    can_assign_role,
    can_manage_member,
    has_permission,
)


def test_permissions_are_cumulative() -> None:
    order = [Role.VIEWER, Role.ANALYST, Role.ADMIN, Role.OWNER]
    for lower, higher in zip(order, order[1:], strict=False):
        for perm in Permission:
            if has_permission(lower, perm):
                assert has_permission(higher, perm), f"{higher} lacks {perm} that {lower} has"


@pytest.mark.parametrize(
    ("role", "perm", "expected"),
    [
        (Role.VIEWER, Permission.DECISIONS_READ, True),
        (Role.VIEWER, Permission.DECISIONS_WRITE, False),
        (Role.ANALYST, Permission.DECISIONS_WRITE, True),
        (Role.ANALYST, Permission.MEMBERS_MANAGE, False),
        (Role.ADMIN, Permission.MEMBERS_MANAGE, True),
        (Role.ADMIN, Permission.BILLING_MANAGE, False),
        (Role.OWNER, Permission.BILLING_MANAGE, True),
    ],
)
def test_role_matrix(role: Role, perm: Permission, expected: bool) -> None:
    assert has_permission(role, perm) is expected


def test_admin_cannot_create_or_touch_owners() -> None:
    assert can_assign_role(Role.ADMIN, Role.ADMIN)
    assert not can_assign_role(Role.ADMIN, Role.OWNER)
    assert not can_manage_member(Role.ADMIN, Role.OWNER)
    assert can_manage_member(Role.ADMIN, Role.ANALYST)


def test_owner_can_do_everything_with_members() -> None:
    assert all(can_assign_role(Role.OWNER, r) for r in Role)
    assert all(can_manage_member(Role.OWNER, r) for r in Role)


def test_analyst_and_viewer_cannot_manage_members() -> None:
    for actor in (Role.ANALYST, Role.VIEWER):
        assert not any(can_assign_role(actor, r) for r in Role)
        assert not any(can_manage_member(actor, r) for r in Role)
