"""Authentication flows, end to end through the HTTP API (real Postgres + Redis)."""

from sqlalchemy import text

from app.core.email import test_outbox
from tests.conftest import STRONG_PASSWORD, register, token_from_last_email


def test_register_creates_user_org_owner_and_session(make_client) -> None:
    c = make_client()
    me = register(c, "amina@acme.example.com", org_name="Acme Cameroun")

    assert me["user"]["email"] == "amina@acme.example.com"
    assert me["user"]["email_verified"] is False
    assert len(me["memberships"]) == 1
    assert me["memberships"][0]["role"] == "owner"
    assert me["memberships"][0]["organization"]["name"] == "Acme Cameroun"
    assert c.cookies.get("dg_session") and c.cookies.get("dg_csrf")
    assert c.get("/auth/me").status_code == 200
    assert any("verify-email?token=" in m.body for m in test_outbox)


def test_password_is_hashed_with_argon2(make_client, owner_engine) -> None:
    register(make_client(), "hash@acme.example.com")
    with owner_engine.connect() as conn:
        stored = conn.execute(text("SELECT password_hash FROM users")).scalar_one()
    assert stored.startswith("$argon2id$")
    assert STRONG_PASSWORD not in stored


def test_duplicate_email_is_rejected_case_insensitively(make_client) -> None:
    register(make_client(), "dup@acme.example.com")
    r = make_client().post(
        "/auth/register",
        headers={"Accept-Language": "en"},
        json={
            "email": "DUP@acme.example.com",
            "password": STRONG_PASSWORD,
            "full_name": "X",
            "organization": {"name": "Other", "country_code": "FR", "currency": "EUR"},
        },
    )
    assert r.status_code == 409
    assert r.json()["error"]["code"] == "auth.email_taken"
    assert r.json()["error"]["message"].startswith("An account already exists")


def test_weak_password_rejected_with_localized_message(make_client) -> None:
    r = make_client().post(
        "/auth/register",
        headers={"Accept-Language": "fr-CM"},
        json={
            "email": "weak@acme.example.com",
            "password": "short",
            "full_name": "W",
            "organization": {"name": "Weak", "country_code": "CM", "currency": "XAF"},
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "auth.weak_password"
    assert "12 caractères" in r.json()["error"]["message"]


def test_invalid_org_fields_rejected(make_client) -> None:
    r = make_client().post(
        "/auth/register",
        json={
            "email": "x@acme.example.com",
            "password": STRONG_PASSWORD,
            "full_name": "X",
            "organization": {"name": "X Co", "country_code": "cameroon", "currency": "xaf"},
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_login_logout_cycle(make_client) -> None:
    register(make_client(), "cycle@acme.example.com")
    c = make_client()
    assert c.get("/auth/me").status_code == 401

    bad = c.post(
        "/auth/login", json={"email": "cycle@acme.example.com", "password": "wrong-password"}
    )
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "auth.invalid_credentials"

    ok = c.post(
        "/auth/login", json={"email": "Cycle@Acme.example.com", "password": STRONG_PASSWORD}
    )
    assert ok.status_code == 200
    assert c.get("/auth/me").status_code == 200

    assert c.post("/auth/logout").status_code == 204
    assert c.get("/auth/me").status_code == 401


def test_unknown_email_and_wrong_password_are_indistinguishable(make_client) -> None:
    register(make_client(), "known@acme.example.com")
    c = make_client()
    a = c.post(
        "/auth/login", json={"email": "known@acme.example.com", "password": "nope-nope-nope"}
    )
    b = c.post(
        "/auth/login", json={"email": "ghost@acme.example.com", "password": "nope-nope-nope"}
    )
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_login_is_rate_limited(make_client) -> None:
    register(make_client(), "brute@acme.example.com")
    c = make_client()
    codes = [
        c.post(
            "/auth/login", json={"email": "brute@acme.example.com", "password": f"guess-{i:08d}"}
        ).status_code
        for i in range(11)
    ]
    assert codes[:10] == [401] * 10
    assert codes[10] == 429
    # Even the right password is refused while locked out.
    r = c.post("/auth/login", json={"email": "brute@acme.example.com", "password": STRONG_PASSWORD})
    assert r.status_code == 429


def test_failed_logins_are_audited(make_client, owner_engine) -> None:
    register(make_client(), "aud@acme.example.com")
    make_client().post(
        "/auth/login", json={"email": "aud@acme.example.com", "password": "bad-bad-bad"}
    )
    with owner_engine.connect() as conn:
        n = conn.execute(
            text("SELECT count(*) FROM audit_logs WHERE action = 'auth.login_failed'")
        ).scalar_one()
    assert n == 1


def test_csrf_header_required_when_authenticated(make_client) -> None:
    c = make_client()
    register(c, "csrf@acme.example.com")
    # Bypass the helper that adds the header automatically.
    r = c.post("/auth/logout", headers={"X-CSRF-Token": "forged-value"})
    assert r.status_code == 403
    assert r.json()["error"]["code"] == "csrf_failed"
    assert c.get("/auth/me").status_code == 200  # still logged in


def test_email_verification_single_use(make_client) -> None:
    c = make_client()
    register(c, "verify@acme.example.com")
    token = token_from_last_email("verify-email")

    assert c.post("/auth/verify-email", json={"token": token}).status_code == 204
    assert c.get("/auth/me").json()["user"]["email_verified"] is True
    again = c.post("/auth/verify-email", json={"token": token})
    assert again.status_code == 400
    assert again.json()["error"]["code"] == "auth.invalid_token"


def test_forgot_password_does_not_reveal_accounts(make_client) -> None:
    c = make_client()
    r = c.post("/auth/password/forgot", json={"email": "nobody@acme.example.com"})
    assert r.status_code == 202
    assert test_outbox == []


def test_password_reset_flow_revokes_sessions(make_client) -> None:
    victim = make_client()
    register(victim, "reset@acme.example.com")
    test_outbox.clear()

    anon = make_client()
    assert (
        anon.post("/auth/password/forgot", json={"email": "reset@acme.example.com"}).status_code
        == 202
    )
    token = token_from_last_email("reset-password")

    new_pw = "a-brand-new-long-password"
    r = anon.post("/auth/password/reset", json={"token": token, "password": new_pw})
    assert r.status_code == 204
    assert victim.get("/auth/me").status_code == 401  # existing sessions revoked

    login = anon.post("/auth/login", json={"email": "reset@acme.example.com", "password": new_pw})
    assert login.status_code == 200
    reuse = anon.post("/auth/password/reset", json={"token": token, "password": new_pw + "x"})
    assert reuse.status_code == 400


def test_only_latest_reset_link_works(make_client) -> None:
    register(make_client(), "latest@acme.example.com")
    c = make_client()
    c.post("/auth/password/forgot", json={"email": "latest@acme.example.com"})
    first = token_from_last_email("reset-password")
    c.post("/auth/password/forgot", json={"email": "latest@acme.example.com"})
    second = token_from_last_email("reset-password")
    assert first != second
    pw = "another-long-password-1"
    assert c.post("/auth/password/reset", json={"token": first, "password": pw}).status_code == 400
    assert c.post("/auth/password/reset", json={"token": second, "password": pw}).status_code == 204


def test_change_password_revokes_other_sessions(make_client) -> None:
    a = make_client()
    register(a, "change@acme.example.com")
    b = make_client()
    b.post("/auth/login", json={"email": "change@acme.example.com", "password": STRONG_PASSWORD})
    assert b.get("/auth/me").status_code == 200

    wrong = a.post(
        "/auth/password/change",
        json={"current_password": "not-it-at-all", "new_password": "x" * 20},
    )
    assert wrong.status_code == 400

    ok = a.post(
        "/auth/password/change",
        json={"current_password": STRONG_PASSWORD, "new_password": "brand-new-secret-phrase"},
    )
    assert ok.status_code == 204
    assert a.get("/auth/me").status_code == 200  # current session kept
    assert b.get("/auth/me").status_code == 401  # other session revoked


def test_password_containing_email_name_is_rejected(make_client) -> None:
    r = make_client().post(
        "/auth/register",
        json={
            "email": "kouassi@acme.example.com",
            "password": "kouassi-2026-password",
            "full_name": "K",
            "organization": {"name": "K Co", "country_code": "CI", "currency": "XOF"},
        },
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "auth.password_contains_email"


def test_client_ip_from_relay_requires_secret(make_client, owner_engine) -> None:
    c = make_client()
    c.post(
        "/auth/login",
        headers={"X-DG-Client-IP": "203.0.113.7", "X-DG-Relay-Secret": "test-relay-secret"},
        json={"email": "a@acme.example.com", "password": "whatever-wrong"},
    )
    c.post(
        "/auth/login",
        headers={"X-DG-Client-IP": "198.51.100.66", "X-DG-Relay-Secret": "forged"},
        json={"email": "a@acme.example.com", "password": "whatever-wrong"},
    )
    with owner_engine.connect() as conn:
        ips = (
            conn.execute(
                text(
                    "SELECT host(ip) FROM audit_logs WHERE action = 'auth.login_failed' ORDER BY id"
                )
            )
            .scalars()
            .all()
        )
    assert ips[0] == "203.0.113.7"  # trusted: secret matches
    assert ips[1] != "198.51.100.66"  # spoofed header ignored
