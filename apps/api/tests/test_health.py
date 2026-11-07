from fastapi.testclient import TestClient

from app.api import health
from app.main import app

client = TestClient(app)


def test_liveness() -> None:
    r = client.get("/health/live")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_readiness_ok_when_all_dependencies_up(monkeypatch) -> None:
    monkeypatch.setattr(health, "_check_database", lambda: "ok")
    monkeypatch.setattr(health, "_check_redis", lambda: "ok")
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_readiness_503_when_dependency_down(monkeypatch) -> None:
    monkeypatch.setattr(health, "_check_database", lambda: "error")
    monkeypatch.setattr(health, "_check_redis", lambda: "ok")
    r = client.get("/health")
    assert r.status_code == 503
    body = r.json()
    assert body["status"] == "degraded"
    assert body["checks"]["database"] == "error"
