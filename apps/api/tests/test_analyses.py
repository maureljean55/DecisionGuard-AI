"""Follow-up questions, quotas and the analysis queue/worker."""

import uuid

import pytest
from sqlalchemy import create_engine, text

from app.analyses.precheck import missing_information
from app.core.config import get_settings
from app.models import AnalysisStatus, Decision, DecisionCategory
from app.worker.pipeline import EngineUnavailable, NoEnginePipeline
from app.worker.queue import process_one, recover_stale
from tests.conftest import register, token_from_last_email

COMPLETE = {
    "title": "Ouvrir une filiale à Douala",
    "description": "Implanter une filiale commerciale au Cameroun pour servir la zone CEMAC, "
    "avec une équipe de vente locale de huit personnes et un entrepôt de 2 000 m².",
    "category": "operational",
    "amount": "1600000000",
    "deadline": "2027-06-30",
    "context": "Concurrent principal déjà présent à Douala. Deux fournisseurs locaux identifiés, "
    "un seul certifié. Parité fixe XAF/EUR.",
}
SPARSE = {
    "title": "Lancer une offre",
    "description": "Nouvelle offre de services aux PME.",
    "category": "commercial",
}


def _org(me: dict) -> str:
    return me["memberships"][0]["organization"]["id"]


def _setup(make_client, email="q@acme.example.com"):
    c = make_client()
    return c, _org(register(c, email))


def _submit(c, org, body=COMPLETE):
    r = c.post(f"/orgs/{org}/decisions", json={**body, "submit": True})
    assert r.status_code == 201, r.text
    return r.json()


# ------------------------------------------------------------------ pre-check


def test_precheck_rules() -> None:
    d = Decision(title="x", description="court", category=DecisionCategory.STRATEGIC)
    assert missing_information(d) == ["amount", "deadline", "scope", "context", "alternatives"]
    d = Decision(
        title="x",
        description="a" * 200,
        category=DecisionCategory.LEGAL,
        context="b" * 100,
        deadline="2027-01-01",
    )
    assert missing_information(d) == []  # amount not required for legal decisions


# ------------------------------------------------------------------ questions


def test_complete_decision_goes_straight_to_queue(make_client) -> None:
    c, org = _setup(make_client)
    d = _submit(c, org)
    assert d["status"] == "submitted"
    assert d["latest_analysis"]["status"] == "pending"
    assert d["latest_analysis"]["open_questions"] == 0
    # No engine configured yet: the API says so instead of promising an imminent start.
    assert d["latest_analysis"]["waiting_reason"] == "engine_unavailable"


def test_missing_information_triggers_questions(make_client) -> None:
    c, org = _setup(make_client)
    d = _submit(c, org, SPARSE)
    la = d["latest_analysis"]
    assert la["status"] == "collecting_info" and la["open_questions"] == 5
    a = c.get(f"/orgs/{org}/analyses/{la['id']}").json()
    assert [q["key"] for q in a["questions"]] == [
        "amount",
        "deadline",
        "scope",
        "context",
        "alternatives",
    ]
    for q in a["questions"][:-1]:
        r = c.put(
            f"/orgs/{org}/analyses/{la['id']}/questions/{q['id']}",
            json={"answer": f"Réponse à {q['key']}"},
        )
        assert r.json()["status"] == "collecting_info"
    last = a["questions"][-1]
    r = c.put(f"/orgs/{org}/analyses/{la['id']}/questions/{last['id']}", json={"unknown": True})
    assert r.json()["status"] == "pending"
    assert r.json()["questions"][-1]["unknown"] is True
    # No more answers once queued.
    assert (
        c.put(
            f"/orgs/{org}/analyses/{la['id']}/questions/{last['id']}", json={"answer": "trop tard"}
        ).status_code
        == 409
    )


def test_answer_validation_and_permissions(make_client) -> None:
    owner, org = _setup(make_client, "own@acme.example.com")
    la = _submit(owner, org, SPARSE)["latest_analysis"]
    q = owner.get(f"/orgs/{org}/analyses/{la['id']}").json()["questions"][0]
    url = f"/orgs/{org}/analyses/{la['id']}/questions/{q['id']}"
    assert owner.put(url, json={"answer": "   "}).status_code == 422

    owner.post(f"/orgs/{org}/invitations", json={"email": "v@acme.example.com", "role": "viewer"})
    token = token_from_last_email("invite")
    viewer = make_client()
    viewer.post(
        "/auth/register",
        json={"email": "v@acme.example.com", "password": "a-long-enough-pass", "full_name": "V"},
    )
    viewer.post("/invitations/accept", json={"token": token})
    assert viewer.get(url.rsplit("/questions", 1)[0]).status_code == 200
    assert viewer.put(url, json={"answer": "x"}).status_code == 403

    other, other_org = _setup(make_client, "spy@evil.example.com")
    assert other.get(f"/orgs/{org}/analyses/{la['id']}").status_code == 404
    assert other.get(f"/orgs/{other_org}/analyses/{la['id']}").status_code == 404


def test_reopen_cancels_and_resubmit_creates_new(make_client) -> None:
    c, org = _setup(make_client)
    d = _submit(c, org)
    first = d["latest_analysis"]["id"]
    c.patch(f"/orgs/{org}/decisions/{d['id']}", json={"status": "draft"})
    hist = c.get(f"/orgs/{org}/decisions/{d['id']}/analyses").json()
    assert hist[0]["status"] == "canceled"
    r = c.post(f"/orgs/{org}/decisions/{d['id']}/submit")
    assert r.json()["latest_analysis"]["id"] != first
    # Submitting again while active returns the same analysis, no duplicate.
    again = c.post(f"/orgs/{org}/decisions/{d['id']}/submit").json()
    assert again["latest_analysis"]["id"] == r.json()["latest_analysis"]["id"]


# ------------------------------------------------------------------ quotas


def test_monthly_quota_enforced_server_side(make_client) -> None:
    c, org = _setup(make_client)
    assert c.get(f"/orgs/{org}/usage").json() == {
        "plan": "starter",
        "period_start": c.get(f"/orgs/{org}/usage").json()["period_start"],
        "used": 0,
        "limit": 5,
    }
    ids = [_submit(c, org)["id"] for _ in range(5)]
    r = c.post(
        f"/orgs/{org}/decisions",
        headers={"Accept-Language": "fr"},
        json={**COMPLETE, "submit": True},
    )
    assert r.status_code == 402
    assert r.json()["error"]["code"] == "quota.exceeded"
    assert "5 analyses par mois" in r.json()["error"]["message"]
    # The decision itself was not saved as submitted.
    assert all(
        x["status"] != "submitted" or x["id"] in ids for x in c.get(f"/orgs/{org}/decisions").json()
    )
    # Cancelling an analysis gives the slot back.
    c.patch(f"/orgs/{org}/decisions/{ids[0]}", json={"status": "draft"})
    assert c.get(f"/orgs/{org}/usage").json()["used"] == 4
    assert _submit(c, org)["status"] == "submitted"


# ------------------------------------------------------------------ worker


@pytest.fixture
def owner_db(migrated):
    engine = create_engine(get_settings().migration_database_url)
    yield engine
    engine.dispose()


def _analysis(owner_db, aid):
    with owner_db.connect() as conn:
        return (
            conn.execute(text("SELECT * FROM analyses WHERE id = :i"), {"i": aid}).mappings().one()
        )


class Stages:
    def __init__(self, fail_times=0, exc=RuntimeError):
        self.calls, self.fail_times, self.exc, self.seen = 0, fail_times, exc, []

    def run(self, job):
        self.calls += 1
        # The pipeline only sees its own tenant.
        self.seen.append(job.db.execute(text("SELECT count(*) FROM organizations")).scalar_one())
        for st in (
            AnalysisStatus.ANALYZING,
            AnalysisStatus.SIMULATING,
            AnalysisStatus.VERIFYING,
            AnalysisStatus.REPORTING,
        ):
            job.stage(st)
        if self.calls <= self.fail_times:
            raise self.exc("boom")


def test_idle_when_nothing_queued(make_client) -> None:
    c, org = _setup(make_client)
    _submit(c, org, SPARSE)  # collecting_info: not claimable
    assert process_one(NoEnginePipeline(), "w") == "idle"


def test_no_engine_keeps_job_waiting_without_results(make_client, owner_db) -> None:
    c, org = _setup(make_client)
    aid = _submit(c, org)["latest_analysis"]["id"]
    assert process_one(NoEnginePipeline(), "w") == "waiting"
    a = _analysis(owner_db, aid)
    assert a["status"] == "pending" and a["waiting_reason"] == "engine_unavailable"
    assert a["attempts"] == 0 and a["next_attempt_at"] is not None
    assert process_one(NoEnginePipeline(), "w") == "idle"  # not re-claimed before the delay


def test_successful_pipeline_completes_in_tenant_context(make_client, owner_db) -> None:
    c, org = _setup(make_client)
    _setup(make_client, "other@beta.example.com")  # a second tenant exists
    aid = _submit(c, org)["latest_analysis"]["id"]
    p = Stages()
    assert process_one(p, "w") == "completed"
    assert p.seen == [1]  # RLS: only its own organisation is visible
    a = _analysis(owner_db, aid)
    assert a["status"] == "completed" and a["finished_at"] and a["locked_by"] is None
    assert c.get(f"/orgs/{org}/analyses/{aid}").json()["status"] == "completed"


def test_failures_retry_with_backoff_then_fail(make_client, owner_db) -> None:
    c, org = _setup(make_client)
    aid = _submit(c, org)["latest_analysis"]["id"]
    p = Stages(fail_times=99)
    assert process_one(p, "w") == "retry"
    a = _analysis(owner_db, aid)
    assert a["status"] == "pending" and a["attempts"] == 1 and a["error_code"] == "pipeline_error"
    for _ in range(2):  # make the job due again and retry until max_attempts
        with owner_db.begin() as conn:
            conn.execute(
                text("UPDATE analyses SET next_attempt_at = now() WHERE id = :i"), {"i": aid}
            )
        process_one(p, "w")
    a = _analysis(owner_db, aid)
    assert a["status"] == "failed" and a["attempts"] == 3
    assert a["error_message"] == "RuntimeError"  # no tenant data in error details

    r = c.post(f"/orgs/{org}/analyses/{aid}/retry")
    assert r.status_code == 200 and r.json()["status"] == "pending"
    assert c.get(f"/orgs/{org}/usage").json()["used"] == 1  # retry is not charged twice
    assert c.post(f"/orgs/{org}/analyses/{aid}/retry").status_code == 409


def test_stale_running_job_is_recovered(make_client, owner_db) -> None:
    c, org = _setup(make_client)
    aid = _submit(c, org)["latest_analysis"]["id"]
    with owner_db.begin() as conn:
        conn.execute(
            text(
                "UPDATE analyses SET status='analyzing', attempts=1, "
                "heartbeat_at = now() - interval '1 hour' WHERE id = :i"
            ),
            {"i": aid},
        )
    assert recover_stale(900) == 1
    a = _analysis(owner_db, aid)
    assert a["status"] == "pending" and a["error_code"] == "timeout"
    with owner_db.begin() as conn:
        conn.execute(
            text(
                "UPDATE analyses SET status='verifying', attempts=3, "
                "heartbeat_at = now() - interval '1 hour' WHERE id = :i"
            ),
            {"i": aid},
        )
    recover_stale(900)
    assert _analysis(owner_db, aid)["status"] == "failed"


def test_cancel_during_run_is_respected(make_client, owner_db) -> None:
    c, org = _setup(make_client)
    d = _submit(c, org)
    aid = d["latest_analysis"]["id"]

    class CancelMidway:
        def run(self, job):
            job.stage(AnalysisStatus.ANALYZING)
            c.patch(f"/orgs/{org}/decisions/{d['id']}", json={"status": "draft"})
            job.stage(AnalysisStatus.SIMULATING)

    assert process_one(CancelMidway(), "w") == "canceled"
    assert _analysis(owner_db, aid)["status"] == "canceled"


def test_worker_functions_are_not_callable_by_public_roles(owner_db) -> None:
    with owner_db.connect() as conn:
        for role in ("anon", "authenticated"):
            for fn in ("claim_next_analysis(text)", "recover_stale_analyses(integer)"):
                allowed = conn.execute(
                    text("SELECT has_function_privilege(:r, :f, 'EXECUTE')"), {"r": role, "f": fn}
                ).scalar_one()
                assert not allowed, (role, fn)


def test_engine_unavailable_is_an_exception_type() -> None:
    with pytest.raises(EngineUnavailable):
        NoEnginePipeline().run(None)  # type: ignore[arg-type]
    assert uuid.UUID(int=0)  # keep import used


# ------------------------------------------------------------------ serverless tick


def test_worker_tick_requires_the_shared_secret(make_client, owner_db) -> None:
    c, org = _setup(make_client)
    aid = _submit(c, org)["latest_analysis"]["id"]
    anon = make_client()
    assert anon.post("/internal/worker/tick").status_code == 404
    assert (
        anon.post("/internal/worker/tick", headers={"x-dg-relay-secret": "nope"}).status_code == 404
    )
    r = anon.get("/internal/worker/tick", headers={"authorization": "Bearer test-relay-secret"})
    assert r.status_code == 200 and r.json() == {"outcomes": ["waiting"]}  # engine "none" in tests
    assert _analysis(owner_db, aid)["waiting_reason"] == "engine_unavailable"
    r = anon.post("/internal/worker/tick", headers={"x-dg-relay-secret": "test-relay-secret"})
    assert r.json() == {"outcomes": ["idle"]}
