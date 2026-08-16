"""YouTube review mode tests. No network access: yt-dlp calls are monkeypatched."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app
from app.services import youtube as yt_service

SAMPLE_URL = "https://www.youtube.com/watch?v=fTL3zWj997g"


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("TENNIS_DATA_DIR", str(tmp_path))
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as c:
        yield c
    get_settings.cache_clear()


@pytest.fixture()
def vision_client(tmp_path, monkeypatch):
    """Client with an LLM key configured (vision-review engine path)."""
    monkeypatch.setenv("TENNIS_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("TENNIS_OPENAI_API_KEY", "test-key")
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as c:
        yield c
    get_settings.cache_clear()


# ---------------------------------------------------------------------------
# URL parsing
# ---------------------------------------------------------------------------

def test_parse_youtube_url_accepts_common_forms():
    assert yt_service.parse_youtube_url("https://www.youtube.com/watch?v=fTL3zWj997g") == "fTL3zWj997g"
    assert yt_service.parse_youtube_url("http://youtu.be/fTL3zWj997g?t=30") == "fTL3zWj997g"
    assert (
        yt_service.parse_youtube_url("https://m.youtube.com/watch?v=fTL3zWj997g&list=PLx&t=60")
        == "fTL3zWj997g"
    )
    assert yt_service.parse_youtube_url("https://www.youtube.com/shorts/fTL3zWj997g") == "fTL3zWj997g"
    assert yt_service.parse_youtube_url("https://www.youtube.com/embed/fTL3zWj997g") == "fTL3zWj997g"
    assert yt_service.parse_youtube_url("youtu.be/fTL3zWj997g") == "fTL3zWj997g"


def test_parse_youtube_url_rejects_non_youtube():
    assert yt_service.parse_youtube_url("") is None
    assert yt_service.parse_youtube_url("not a url") is None
    assert yt_service.parse_youtube_url("https://vimeo.com/123456") is None
    assert yt_service.parse_youtube_url("https://youtube.com/watch?list=only") is None
    assert yt_service.parse_youtube_url("https://evil.com/youtube.com/watch?v=fTL3zWj997g") is None


# ---------------------------------------------------------------------------
# Creation-time validation
# ---------------------------------------------------------------------------

def test_health_reports_youtube_flag(client, monkeypatch):
    monkeypatch.setattr(yt_service, "is_available", lambda: True)
    assert client.get("/api/health").json()["youtube_ready"] is True


def test_youtube_mode_rejects_non_youtube_url(client, monkeypatch):
    monkeypatch.setattr(yt_service, "is_available", lambda: True)
    r = client.post("/api/analyses", json={"mode": "youtube", "youtube_url": "https://vimeo.com/x"})
    assert r.status_code == 400
    assert "youtube_url" in r.json()["detail"]


def test_youtube_mode_needs_yt_dlp(client, monkeypatch):
    monkeypatch.setattr(yt_service, "is_available", lambda: False)
    r = client.post("/api/analyses", json={"mode": "youtube", "youtube_url": SAMPLE_URL})
    assert r.status_code == 400
    assert "yt-dlp" in r.json()["detail"]


def test_youtube_mode_needs_engine(client, monkeypatch):
    monkeypatch.setattr(yt_service, "is_available", lambda: True)
    # default test settings: no YOLO weights, no LLM key
    r = client.post("/api/analyses", json={"mode": "youtube", "youtube_url": SAMPLE_URL})
    assert r.status_code == 400
    assert "TENNIS_OPENAI_API_KEY" in r.json()["detail"]


# ---------------------------------------------------------------------------
# Vision-review happy path (probe/download/vision all mocked)
# ---------------------------------------------------------------------------

def test_youtube_vision_review_end_to_end(vision_client, monkeypatch):
    monkeypatch.setattr(yt_service, "is_available", lambda: True)
    info = yt_service.VideoInfo(id="fTL3zWj997g", title="My Club Match", duration_s=1800, uploader="me")
    monkeypatch.setattr(yt_service, "probe", lambda url: info)

    def fake_download(url, dest_dir, stem, max_height=720, on_progress=None):
        dest_dir.mkdir(parents=True, exist_ok=True)
        p = dest_dir / f"{stem}.mp4"
        p.write_bytes(b"fake-video")
        if on_progress:
            on_progress("42%")
        return p, info

    monkeypatch.setattr(yt_service, "download", fake_download)
    monkeypatch.setattr(
        "app.services.llm.vision.generate_review",
        lambda path, settings, title: "## 比赛速览\n\nfake vision review",
    )

    r = vision_client.post("/api/analyses", json={"mode": "youtube", "youtube_url": SAMPLE_URL})
    assert r.status_code == 200, r.text
    aid = r.json()["analysis_id"]

    body = vision_client.get(f"/api/analyses/{aid}").json()
    assert body["status"] == "done", body
    assert body["engine"] == "llm_vision"
    stages = {s["name"]: s["status"] for s in body["stages"]}
    assert stages["download"] == "done"
    assert stages["ingest"] == "skipped"
    assert stages["detect"] == "skipped"
    assert stages["report"] == "done"

    result = body["result"]
    assert result["mode"] == "youtube"
    assert result["report_generated_by"] == "llm_vision"
    assert result["source_url"] == SAMPLE_URL
    assert result["source_title"] == "My Club Match"
    assert "fake vision review" in result["report"]


def test_youtube_duration_guard_fails_job(vision_client, monkeypatch):
    monkeypatch.setattr(yt_service, "is_available", lambda: True)
    info = yt_service.VideoInfo(id="fTL3zWj997g", title="Marathon", duration_s=3 * 3600)
    monkeypatch.setattr(yt_service, "probe", lambda url: info)

    r = vision_client.post("/api/analyses", json={"mode": "youtube", "youtube_url": SAMPLE_URL})
    assert r.status_code == 200
    body = vision_client.get(f"/api/analyses/{r.json()['analysis_id']}").json()
    assert body["status"] == "failed"
    assert "TENNIS_YOUTUBE_MAX_DURATION_MIN" in body["error"]


def test_youtube_private_video_fails_with_friendly_error(vision_client, monkeypatch):
    monkeypatch.setattr(yt_service, "is_available", lambda: True)

    def raise_private(url):
        raise yt_service.YouTubeError("this YouTube video is private and cannot be downloaded")

    monkeypatch.setattr(yt_service, "probe", raise_private)
    r = vision_client.post("/api/analyses", json={"mode": "youtube", "youtube_url": SAMPLE_URL})
    assert r.status_code == 200
    body = vision_client.get(f"/api/analyses/{r.json()['analysis_id']}").json()
    assert body["status"] == "failed"
    assert "private" in body["error"]


# ---------------------------------------------------------------------------
# History (persisted results must be listed even without in-memory jobs)
# ---------------------------------------------------------------------------

def test_history_lists_persisted_analyses(client):
    from datetime import datetime, timezone

    from app.domain.events import AnalysisResult
    from app.services import storage

    settings = get_settings()
    result = AnalysisResult(
        id="persisted01",
        created_at=datetime.now(timezone.utc).isoformat(),
        source="YouTube · Old Match",
        mode="youtube",
        fps=0.0,
        source_url=SAMPLE_URL,
    )
    storage.save_analysis(settings, result)

    items = client.get("/api/analyses").json()
    mine = [i for i in items if i["id"] == "persisted01"]
    assert mine and mine[0]["status"] == "done"
    assert mine[0]["title"] == "YouTube · Old Match"
    assert mine[0]["source_url"] == SAMPLE_URL
