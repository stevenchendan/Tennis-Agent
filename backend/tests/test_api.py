"""API tests with the FastAPI TestClient (demo mode, heuristic LLM fallback)."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("TENNIS_DATA_DIR", str(tmp_path))
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as c:  # TestClient runs BackgroundTasks after responses
        yield c
    get_settings.cache_clear()


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["llm_enabled"] is False
    assert body["full_mode_ready"] is False


def test_demo_analysis_end_to_end(client):
    r = client.post("/api/analyses", json={"mode": "demo"})
    assert r.status_code == 200, r.text
    aid = r.json()["analysis_id"]

    r = client.get(f"/api/analyses/{aid}")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "done", body
    result = body["result"]
    assert result["mode"] == "demo"
    assert len(result["rallies"]) >= 15
    assert len(result["patterns"]) >= 3
    assert result["report"] and "heuristic" == result["report_generated_by"]
    assert "比赛速览" in result["report"]


def test_patterns_endpoint(client):
    aid = client.post("/api/analyses", json={"mode": "demo"}).json()["analysis_id"]
    r = client.get(f"/api/analyses/{aid}/patterns")
    assert r.status_code == 200
    cards = r.json()["patterns"]
    assert any("serve" in c["category"] for c in cards)


def test_chat_endpoint_heuristic_fallback(client):
    aid = client.post("/api/analyses", json={"mode": "demo"}).json()["analysis_id"]
    r = client.post(f"/api/analyses/{aid}/chat", json={"message": "发球哪个方向最有效？"})
    assert r.status_code == 200
    assert r.json()["answer"]


def test_full_mode_requires_weights(client):
    r = client.post("/api/analyses", json={"mode": "full", "video_id": "whatever"})
    assert r.status_code == 400
    assert "TENNIS_BALL_MODEL_PATH" in r.json()["detail"]


def test_unknown_analysis_404(client):
    assert client.get("/api/analyses/nope").status_code == 404
