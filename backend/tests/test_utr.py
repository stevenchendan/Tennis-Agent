from app.core.config import Settings
from app.main import create_app
from fastapi.testclient import TestClient


def test_utr_status_is_explicitly_unavailable_without_credentials(monkeypatch):
    monkeypatch.setenv("TENNIS_UTR_CLIENT_ID", "")
    monkeypatch.setenv("TENNIS_UTR_CLIENT_SECRET", "")
    monkeypatch.setenv("TENNIS_UTR_REDIRECT_URI", "")
    Settings.model_config["env_file"] = None
    client = TestClient(create_app())
    body = client.get("/api/utr/status").json()
    assert body["configured"] is False
    assert body["authorized"] is False
    assert body["rating_available"] is False
