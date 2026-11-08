"""Decisions: lifecycle, role-based permissions and tenant isolation."""

import uuid

from sqlalchemy import text

from app.db.session import new_session, set_rls_context
from tests.conftest import register, token_from_last_email

DOUALA = {
    "title": "Ouvrir une filiale à Douala",
    "description": "Implanter une filiale commerciale au Cameroun pour servir la zone CEMAC.",
    "category": "strategic",
    "amount": "1600000000",
    "deadline": "2027-06-30",
}


def _org(me: dict) -> str:
    return me["memberships"][0]["organization"]["id"]


def _join(owner, org_id, make_client, email, role):
    owner.post(f"/orgs/{org_id}/invitations", json={"email": email, "role": role})
    token = token_from_last_email("invite")
    c = make_client()
    c.post(
        "/auth/register", json={"email": email, "password": "a-long-enough-pass", "full_name": "M"}
    )
    assert c.post("/invitations/accept", json={"token": token}).status_code == 200
    return c


def test_create_draft_then_submit_archive(make_client) -> None:
    c = make_client()
    org = _org(register(c, "dec@acme.example.com"))
    r = c.post(f"/orgs/{org}/decisions", json=DOUALA)
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["status"] == "draft" and d["submitted_at"] is None
    assert d["currency"] == "XAF"  # organisation currency by default
    assert d["created_by_name"] == "Dec"

    r = c.patch(f"/orgs/{org}/decisions/{d['id']}", json={"status": "submitted"})
    assert r.json()["status"] == "submitted" and r.json()["submitted_at"]

    assert [x["id"] for x in c.get(f"/orgs/{org}/decisions?status=submitted").json()] == [d["id"]]

    c.patch(f"/orgs/{org}/decisions/{d['id']}", json={"status": "archived"})
    assert c.get(f"/orgs/{org}/decisions").json() == []  # archived hidden by default
    assert len(c.get(f"/orgs/{org}/decisions?status=archived").json()) == 1

    actions = [i["action"] for i in c.get(f"/orgs/{org}/audit-logs").json()["items"]]
    assert actions[:3] == ["decision.archive", "decision.submit", "decision.create"]


def test_submit_directly_and_edit(make_client) -> None:
    c = make_client()
    org = _org(register(c, "sub@acme.example.com"))
    d = c.post(f"/orgs/{org}/decisions", json={**DOUALA, "submit": True}).json()
    assert d["status"] == "submitted"
    r = c.patch(
        f"/orgs/{org}/decisions/{d['id']}", json={"title": "  Filiale à Douala  ", "context": ""}
    )
    assert r.json()["title"] == "Filiale à Douala" and r.json()["context"] is None


def test_validation(make_client) -> None:
    c = make_client()
    org = _org(register(c, "val@acme.example.com"))
    for bad in (
        {**DOUALA, "title": "x"},
        {**DOUALA, "amount": "-5"},
        {**DOUALA, "category": "magic"},
        {**DOUALA, "currency": "eur"},
    ):
        assert c.post(f"/orgs/{org}/decisions", json=bad).status_code == 422


def test_viewer_reads_but_cannot_write(make_client) -> None:
    owner = make_client()
    org = _org(register(owner, "own@acme.example.com"))
    d = owner.post(f"/orgs/{org}/decisions", json=DOUALA).json()
    viewer = _join(owner, org, make_client, "view@acme.example.com", "viewer")
    assert viewer.get(f"/orgs/{org}/decisions").status_code == 200
    assert viewer.get(f"/orgs/{org}/decisions/{d['id']}").status_code == 200
    assert viewer.post(f"/orgs/{org}/decisions", json=DOUALA).status_code == 403
    assert (
        viewer.patch(f"/orgs/{org}/decisions/{d['id']}", json={"title": "Hijack"}).status_code
        == 403
    )
    assert viewer.delete(f"/orgs/{org}/decisions/{d['id']}").status_code == 403


def test_analyst_can_delete_only_own_decisions(make_client) -> None:
    owner = make_client()
    org = _org(register(owner, "boss@acme.example.com"))
    owners = owner.post(f"/orgs/{org}/decisions", json=DOUALA).json()
    analyst = _join(owner, org, make_client, "ana@acme.example.com", "analyst")
    mine = analyst.post(f"/orgs/{org}/decisions", json=DOUALA).json()
    assert analyst.delete(f"/orgs/{org}/decisions/{owners['id']}").status_code == 403
    assert analyst.delete(f"/orgs/{org}/decisions/{mine['id']}").status_code == 204
    # Owners and admins can delete any decision.
    assert owner.delete(f"/orgs/{org}/decisions/{owners['id']}").status_code == 204


def test_decisions_are_isolated_between_companies(make_client) -> None:
    a, b = make_client(), make_client()
    org_a = _org(register(a, "a@alpha.example.com", org_name="Alpha"))
    org_b = _org(register(b, "b@beta.example.com", org_name="Beta"))
    secret = b.post(
        f"/orgs/{org_b}/decisions", json={**DOUALA, "title": "Projet confidentiel"}
    ).json()

    for method, path in [
        ("get", f"/orgs/{org_b}/decisions"),
        ("get", f"/orgs/{org_b}/decisions/{secret['id']}"),
        ("get", f"/orgs/{org_a}/decisions/{secret['id']}"),
        ("patch", f"/orgs/{org_a}/decisions/{secret['id']}"),
        ("delete", f"/orgs/{org_a}/decisions/{secret['id']}"),
    ]:
        kw = {"json": {"title": "pwned"}} if method == "patch" else {}
        assert getattr(a, method)(path, **kw).status_code == 404, (method, path)

    # Database layer: with Alpha's context, Beta's decision does not exist.
    with new_session() as s:
        set_rls_context(s, org_id=uuid.UUID(org_a))
        assert s.execute(text("SELECT count(*) FROM decisions")).scalar_one() == 0
    assert b.get(f"/orgs/{org_b}/decisions/{secret['id']}").json()["title"] == "Projet confidentiel"
