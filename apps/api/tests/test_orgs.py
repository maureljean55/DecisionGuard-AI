"""Organizations, invitations and role-based access control."""

from tests.conftest import register, token_from_last_email


def _org_id(me: dict) -> str:
    return me["memberships"][0]["organization"]["id"]


def _invite_and_join(owner, org_id: str, make_client, email: str, role: str):
    r = owner.post(f"/orgs/{org_id}/invitations", json={"email": email, "role": role})
    assert r.status_code == 201, r.text
    token = token_from_last_email("invite")
    member = make_client()
    register(member, email, org_name=f"{email} own org")
    r = member.post("/invitations/accept", json={"token": token})
    assert r.status_code == 200, r.text
    assert r.json()["role"] == role
    return member


def test_invitation_flow(make_client) -> None:
    owner = make_client()
    org_id = _org_id(register(owner, "owner@acme.example.com"))
    owner.post(
        f"/orgs/{org_id}/invitations", json={"email": "Bob@Acme.example.com", "role": "analyst"}
    )
    token = token_from_last_email("invite")

    anon = make_client()
    preview = anon.get("/invitations/preview", params={"token": token})
    assert preview.status_code == 200
    assert preview.json() == {
        "organization_name": "Acme SARL",
        "email": "bob@acme.example.com",
        "role": "analyst",
    }

    bob = make_client()
    register(bob, "bob@acme.example.com", org_name="Bob Consulting")
    assert bob.post("/invitations/accept", json={"token": token}).status_code == 200
    orgs = {m["organization"]["id"]: m["role"] for m in bob.get("/auth/me").json()["memberships"]}
    assert orgs[org_id] == "analyst" and len(orgs) == 2

    members = owner.get(f"/orgs/{org_id}/members").json()
    assert sorted(m["email"] for m in members) == ["bob@acme.example.com", "owner@acme.example.com"]
    # Token is single-use.
    assert bob.post("/invitations/accept", json={"token": token}).status_code == 400


def test_invitation_requires_matching_email(make_client) -> None:
    owner = make_client()
    org_id = _org_id(register(owner, "owner@acme.example.com"))
    owner.post(f"/orgs/{org_id}/invitations", json={"email": "target@acme.example.com"})
    token = token_from_last_email("invite")

    intruder = make_client()
    register(intruder, "intruder@evil.example.com")
    r = intruder.post("/invitations/accept", json={"token": token})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "invitation.email_mismatch"


def test_revoked_invitation_cannot_be_used(make_client) -> None:
    owner = make_client()
    org_id = _org_id(register(owner, "owner@acme.example.com"))
    inv = owner.post(f"/orgs/{org_id}/invitations", json={"email": "late@acme.example.com"}).json()
    token = token_from_last_email("invite")
    assert owner.delete(f"/orgs/{org_id}/invitations/{inv['id']}").status_code == 204
    late = make_client()
    register(late, "late@acme.example.com")
    assert late.post("/invitations/accept", json={"token": token}).status_code == 400


def test_cannot_invite_existing_member(make_client) -> None:
    owner = make_client()
    org_id = _org_id(register(owner, "owner@acme.example.com"))
    r = owner.post(f"/orgs/{org_id}/invitations", json={"email": "owner@acme.example.com"})
    assert r.status_code == 409


def test_analyst_permissions(make_client) -> None:
    owner = make_client()
    org_id = _org_id(register(owner, "owner@acme.example.com"))
    analyst = _invite_and_join(owner, org_id, make_client, "ana@acme.example.com", "analyst")

    assert analyst.get(f"/orgs/{org_id}").status_code == 200
    assert analyst.get(f"/orgs/{org_id}/members").status_code == 200
    for method, path, body in [
        ("post", f"/orgs/{org_id}/invitations", {"email": "x@acme.example.com"}),
        ("patch", f"/orgs/{org_id}", {"name": "Hijacked"}),
        ("get", f"/orgs/{org_id}/audit-logs", None),
        ("get", f"/orgs/{org_id}/invitations", None),
    ]:
        r = getattr(analyst, method)(path, **({"json": body} if body else {}))
        assert r.status_code == 403, (method, path, r.text)
        assert r.json()["error"]["code"] == "org.forbidden"


def test_admin_cannot_escalate_to_owner_or_touch_owner(make_client) -> None:
    owner = make_client()
    org_id = _org_id(register(owner, "owner@acme.example.com"))
    admin = _invite_and_join(owner, org_id, make_client, "adm@acme.example.com", "admin")
    members = {m["email"]: m for m in owner.get(f"/orgs/{org_id}/members").json()}
    owner_mid, admin_mid = (
        members["owner@acme.example.com"]["id"],
        members["adm@acme.example.com"]["id"],
    )

    assert (
        admin.post(
            f"/orgs/{org_id}/invitations", json={"email": "o2@acme.example.com", "role": "owner"}
        ).status_code
        == 403
    )
    assert (
        admin.patch(f"/orgs/{org_id}/members/{admin_mid}", json={"role": "owner"}).status_code
        == 403
    )
    assert (
        admin.patch(f"/orgs/{org_id}/members/{owner_mid}", json={"role": "viewer"}).status_code
        == 403
    )
    assert admin.delete(f"/orgs/{org_id}/members/{owner_mid}").status_code == 403
    # Admin can still invite non-owners.
    assert (
        admin.post(
            f"/orgs/{org_id}/invitations", json={"email": "v@acme.example.com", "role": "viewer"}
        ).status_code
        == 201
    )


def test_last_owner_is_protected(make_client) -> None:
    owner = make_client()
    org_id = _org_id(register(owner, "owner@acme.example.com"))
    mid = owner.get(f"/orgs/{org_id}/members").json()[0]["id"]

    r = owner.patch(f"/orgs/{org_id}/members/{mid}", json={"role": "admin"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "org.last_owner"
    assert owner.delete(f"/orgs/{org_id}/members/{mid}").status_code == 409


def test_owner_can_promote_then_leave(make_client) -> None:
    owner = make_client()
    org_id = _org_id(register(owner, "owner@acme.example.com"))
    _invite_and_join(owner, org_id, make_client, "heir@acme.example.com", "admin")
    members = {m["email"]: m["id"] for m in owner.get(f"/orgs/{org_id}/members").json()}

    r = owner.patch(
        f"/orgs/{org_id}/members/{members['heir@acme.example.com']}", json={"role": "owner"}
    )
    assert r.status_code == 200
    assert (
        owner.delete(f"/orgs/{org_id}/members/{members['owner@acme.example.com']}").status_code
        == 204
    )
    assert owner.get(f"/orgs/{org_id}").status_code == 404


def test_member_can_leave(make_client) -> None:
    owner = make_client()
    org_id = _org_id(register(owner, "owner@acme.example.com"))
    viewer = _invite_and_join(owner, org_id, make_client, "view@acme.example.com", "viewer")
    mid = next(
        m["id"]
        for m in viewer.get(f"/orgs/{org_id}/members").json()
        if m["email"] == "view@acme.example.com"
    )
    assert viewer.delete(f"/orgs/{org_id}/members/{mid}").status_code == 204
    assert viewer.get(f"/orgs/{org_id}").status_code == 404


def test_update_org_and_audit_trail(make_client) -> None:
    owner = make_client()
    org_id = _org_id(register(owner, "owner@acme.example.com"))
    r = owner.patch(f"/orgs/{org_id}", json={"name": "Acme Afrique", "currency": "XOF"})
    assert r.status_code == 200 and r.json()["name"] == "Acme Afrique"

    page = owner.get(f"/orgs/{org_id}/audit-logs").json()
    actions = [i["action"] for i in page["items"]]
    assert actions[:1] == ["org.update"]
    assert {"auth.register", "org.create"} <= set(actions)
    assert page["items"][0]["details"] == {"fields": ["currency", "name"]}


def test_create_additional_org(make_client) -> None:
    c = make_client()
    register(c, "multi@acme.example.com")
    r = c.post("/orgs", json={"name": "Filiale Sénégal", "country_code": "SN", "currency": "XOF"})
    assert r.status_code == 201
    assert r.json()["role"] == "owner"
    assert r.json()["slug"].startswith("filiale-senegal-")
    assert len(c.get("/auth/me").json()["memberships"]) == 2


def test_invited_person_can_register_without_own_org(make_client) -> None:
    owner = make_client()
    org_id = _org_id(register(owner, "owner@acme.example.com"))
    owner.post(f"/orgs/{org_id}/invitations", json={"email": "solo@acme.example.com"})
    token = token_from_last_email("invite")

    solo = make_client()
    r = solo.post(
        "/auth/register",
        json={"email": "solo@acme.example.com", "password": "a-long-enough-pass", "full_name": "S"},
    )
    assert r.status_code == 201
    assert r.json()["memberships"] == []
    assert solo.post("/invitations/accept", json={"token": token}).status_code == 200
    memberships = solo.get("/auth/me").json()["memberships"]
    assert [m["organization"]["id"] for m in memberships] == [org_id]
