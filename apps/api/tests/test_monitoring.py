"""Monitoring: mitigation actions, periodic re-analysis, carried-over answers."""

import pytest
from sqlalchemy import create_engine, text

from app.agents.brief import Answer, DecisionBrief, render
from app.agents.orchestrator import AgentPipeline
from app.core.config import get_settings
from app.llm.mock import MockProvider
from app.worker.monitoring import schedule_due
from app.worker.queue import process_one
from tests.conftest import register

SPARSE = {
    "title": "Lancer une offre",
    "description": "Nouvelle offre de services aux PME.",
    "category": "commercial",
}


@pytest.fixture
def owner_db():
    engine = create_engine(get_settings().migration_database_url)
    yield engine
    engine.dispose()


def _org(c, email):
    return register(c, email)["memberships"][0]["organization"]["id"]


def _completed(make_client, email="mon@acme.example.com"):
    """A decision whose pre-check questions are all answered and whose analysis completed."""
    c = make_client()
    org = _org(c, email)
    d = c.post(f"/orgs/{org}/decisions", json={**SPARSE, "submit": True}).json()
    aid = d["latest_analysis"]["id"]
    for q in c.get(f"/orgs/{org}/analyses/{aid}").json()["questions"]:
        body = (
            {"unknown": True} if q["key"] == "alternatives" else {"answer": f"Réponse {q['key']}"}
        )
        assert (
            c.put(f"/orgs/{org}/analyses/{aid}/questions/{q['id']}", json=body).status_code == 200
        )
    assert process_one(AgentPipeline(MockProvider()), "w") == "completed"
    return c, org, d["id"], aid


def test_actions_crud_and_isolation(make_client) -> None:
    c, org, did, aid = _completed(make_client)
    me = c.get("/auth/me").json()["user"]["id"]
    finding = c.get(f"/orgs/{org}/analyses/{aid}").json()["agents"][0]["findings"][0]
    r = c.post(
        f"/orgs/{org}/decisions/{did}/actions",
        json={
            "title": "Chiffrer le budget",
            "finding_id": finding["id"],
            "owner_user_id": me,
            "due_date": "2027-01-15",
        },
    )
    assert r.status_code == 201, r.text
    act = r.json()
    assert (
        act["status"] == "todo" and act["owner_name"] and act["decision_title"] == SPARSE["title"]
    )
    done = c.patch(f"/orgs/{org}/actions/{act['id']}", json={"status": "done"}).json()
    assert done["status"] == "done" and done["done_at"]
    back = c.patch(f"/orgs/{org}/actions/{act['id']}", json={"status": "in_progress"}).json()
    assert back["done_at"] is None
    cleared = c.patch(
        f"/orgs/{org}/actions/{act['id']}", json={"clear_owner": True, "clear_due_date": True}
    ).json()
    assert cleared["owner_user_id"] is None and cleared["due_date"] is None
    assert len(c.get(f"/orgs/{org}/actions?decision_id={did}").json()) == 1

    other = make_client()
    other_org = _org(other, "autre@beta.example.com")
    stranger = other.get("/auth/me").json()["user"]["id"]
    bad = c.post(
        f"/orgs/{org}/decisions/{did}/actions",
        json={"title": "Assigner à un inconnu", "owner_user_id": stranger},
    )
    assert bad.status_code == 422
    assert other.get(f"/orgs/{org}/actions").status_code == 404
    assert (
        other.patch(f"/orgs/{other_org}/actions/{act['id']}", json={"status": "done"}).status_code
        == 404
    )
    assert c.delete(f"/orgs/{org}/actions/{act['id']}").status_code == 204
    assert c.get(f"/orgs/{org}/actions").json() == []


def test_resubmission_reuses_previous_answers(make_client) -> None:
    c, org, did, _ = _completed(make_client)
    again = c.post(f"/orgs/{org}/decisions/{did}/submit").json()["latest_analysis"]
    assert again["status"] == "pending" and again["open_questions"] == 0
    qs = c.get(f"/orgs/{org}/analyses/{again['id']}").json()["questions"]
    assert {q["key"]: q["unknown"] for q in qs}["alternatives"] is True
    assert all(q["answered_at"] for q in qs)


def test_scheduled_reanalysis(make_client, owner_db) -> None:
    c, org, did, aid = _completed(make_client)
    assert schedule_due() == 0  # monitoring is off
    assert (
        c.put(f"/orgs/{org}/decisions/{did}/monitoring", json={"every_days": 45}).status_code == 422
    )
    assert c.put(f"/orgs/{org}/decisions/{did}/monitoring", json={"every_days": 30}).json() == {
        "monitor_every_days": 30
    }
    assert c.get(f"/orgs/{org}/decisions/{did}").json()["monitor_every_days"] == 30
    assert schedule_due() == 0  # last analysis is recent
    with owner_db.begin() as conn:
        conn.execute(
            text("UPDATE analyses SET created_at = now() - interval '31 days' WHERE id = :a"),
            {"a": aid},
        )
    assert schedule_due() == 1
    latest = c.get(f"/orgs/{org}/decisions/{did}").json()["latest_analysis"]
    assert latest["id"] != aid and latest["status"] == "pending"
    assert schedule_due() == 0  # an analysis is now active
    # Quota reached: nothing is queued, nothing breaks.
    assert process_one(AgentPipeline(MockProvider()), "w") == "completed"
    with owner_db.begin() as conn:
        conn.execute(text("UPDATE analyses SET created_at = now() - interval '31 days'"))
        conn.execute(text("UPDATE organizations SET plan = 'starter'"))
        conn.execute(text("UPDATE analyses SET quota_period = date_trunc('month', now())::date"))
        for _ in range(5):
            conn.execute(
                text(
                    "INSERT INTO analyses (id, organization_id, decision_id, status, attempts, "
                    "max_attempts, quota_period, created_at, updated_at) SELECT gen_random_uuid(), "
                    "organization_id, decision_id, 'failed', 1, 3, quota_period, "
                    "now() - interval '40 days', now() FROM analyses WHERE id = :a"
                ),
                {"a": aid},
            )
    assert schedule_due() == 0


def test_actions_taken_reach_the_agents(make_client) -> None:
    brief = DecisionBrief(
        title="t",
        description="d",
        category="strategic",
        context="",
        amount=None,
        currency=None,
        deadline=None,
        answers=(Answer("amount", None, True),),
        locale="fr",
        country_code="SN",
        today=__import__("datetime").date(2026, 11, 9),
        actions=(("Budget détaillé validé <ok>", "done"), ("Second fournisseur", "in_progress")),
    )
    out = render(brief)
    assert '<action status="done">Budget détaillé validé &lt;ok&gt;</action>' in out
    assert '<action status="in progress">Second fournisseur</action>' in out
