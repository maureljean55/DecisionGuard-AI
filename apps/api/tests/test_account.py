"""Profile, active sessions and audit actor names."""

from tests.conftest import STRONG_PASSWORD, register


def test_update_profile(make_client) -> None:
    c = make_client()
    register(c, "profile@acme.example.com")
    r = c.patch("/auth/me", json={"full_name": "  Awa Diallo ", "locale": "en"})
    assert r.status_code == 200
    assert r.json()["user"]["full_name"] == "Awa Diallo"
    assert r.json()["user"]["locale"] == "en"
    assert c.patch("/auth/me", json={"locale": "de"}).status_code == 422


def test_sessions_list_and_revoke(make_client) -> None:
    a = make_client()
    register(a, "sess@acme.example.com")
    b = make_client()
    b.post("/auth/login", json={"email": "sess@acme.example.com", "password": STRONG_PASSWORD})

    sessions = a.get("/auth/sessions").json()
    assert len(sessions) == 2
    assert sum(s["current"] for s in sessions) == 1
    other = next(s for s in sessions if not s["current"])

    assert a.delete(f"/auth/sessions/{other['id']}").status_code == 204
    assert b.get("/auth/me").status_code == 401
    assert a.get("/auth/me").status_code == 200
    assert len(a.get("/auth/sessions").json()) == 1


def test_revoke_other_sessions(make_client) -> None:
    a = make_client()
    register(a, "others@acme.example.com")
    b = make_client()
    b.post("/auth/login", json={"email": "others@acme.example.com", "password": STRONG_PASSWORD})
    assert a.post("/auth/sessions/revoke-others").status_code == 204
    assert b.get("/auth/me").status_code == 401
    assert a.get("/auth/me").status_code == 200


def test_cannot_revoke_someone_elses_session(make_client) -> None:
    a = make_client()
    register(a, "alice@acme.example.com")
    b = make_client()
    register(b, "bob@acme.example.com", org_name="Bob Co")
    bob_session = b.get("/auth/sessions").json()[0]["id"]
    assert a.delete(f"/auth/sessions/{bob_session}").status_code == 404
    assert b.get("/auth/me").status_code == 200


def test_audit_log_includes_actor_name(make_client) -> None:
    c = make_client()
    me = register(c, "named@acme.example.com")
    org_id = me["memberships"][0]["organization"]["id"]
    c.patch(f"/orgs/{org_id}", json={"name": "Renamed"})
    item = c.get(f"/orgs/{org_id}/audit-logs").json()["items"][0]
    assert item["action"] == "org.update"
    assert item["actor_name"] == "Named"
    assert item["actor_email"] == "named@acme.example.com"
