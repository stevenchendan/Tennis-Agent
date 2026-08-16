"""HTTP API surface."""

from __future__ import annotations

import logging
import re
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.domain.events import AnalysisResult
from app.services import pipeline, storage, youtube
from app.services.jobs import JobStatus, YOUTUBE_STAGES, job_store
from app.tour import db as tour_db
from app.tour import scouting as tour_scouting

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

_SAFE_NAME = re.compile(r"[^A-Za-z0-9_.-]")


def _tour_db_path(settings: Settings):
    from pathlib import Path

    return settings.data_dir / "tour" / tour_db.DB_NAME


def _tour_conn(settings: Settings):
    import sqlite3

    path = _tour_db_path(settings)
    if not path.exists():
        raise HTTPException(
            503,
            "tour database not built yet: run python scripts/tour_sync.py "
            "(downloads ATP/WTA archive and builds SQLite)",
        )
    return tour_db.get_conn(path)


@router.get("/health")
def health(settings: Settings = Depends(get_settings)) -> dict:
    return {
        "status": "ok",
        "version": settings.version,
        "llm_enabled": settings.llm_enabled,
        "full_mode_ready": bool(settings.ball_model_path),
        "youtube_ready": youtube.is_available(),
    }


# ---------------------------------------------------------------------------
# Videos
# ---------------------------------------------------------------------------

@router.post("/videos")
async def upload_video(
    file: UploadFile = File(...), settings: Settings = Depends(get_settings)
) -> dict:
    if not file.filename or not file.filename.lower().endswith((".mp4", ".mov", ".avi", ".mkv")):
        raise HTTPException(400, "unsupported file type (mp4/mov/avi/mkv)")
    video_id = uuid.uuid4().hex[:12]
    safe = _SAFE_NAME.sub("_", file.filename)
    dest = settings.videos_dir / f"{video_id}_{safe}"
    size = 0
    with dest.open("wb") as out:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            out.write(chunk)
    if size < 1024:
        dest.unlink(missing_ok=True)
        raise HTTPException(400, "file too small / empty")
    return {"video_id": video_id, "filename": file.filename, "size": size}


@router.get("/videos")
def list_videos(settings: Settings = Depends(get_settings)) -> list[dict]:
    out = []
    for p in sorted(settings.videos_dir.glob("*"), key=lambda x: -x.stat().st_mtime):
        out.append({"filename": p.name, "size": p.stat().st_size})
    return out


# ---------------------------------------------------------------------------
# Analyses
# ---------------------------------------------------------------------------

class CreateAnalysis(BaseModel):
    video_id: Optional[str] = None
    mode: str = "demo"  # "demo" | "full" | "youtube"
    youtube_url: Optional[str] = None  # required for mode="youtube"


def _get_result_or_404(analysis_id: str, settings: Settings) -> AnalysisResult:
    result = storage.load_analysis(settings, analysis_id)
    if result is None:
        raise HTTPException(404, "analysis not found")
    return result


def _run_job(settings: Settings, job_id: str, video_path=None, youtube_url: str | None = None) -> None:
    job = job_store.get(job_id)
    if job is None:
        return
    try:
        if job.mode == "demo":
            result = pipeline.run_demo_analysis(settings, job)
        elif job.mode == "youtube":
            result = pipeline.run_youtube_analysis(settings, job, youtube_url or "")
        else:
            result = pipeline.run_full_analysis(settings, job, video_path)
        job_store.attach_result(job_id, result)
    except Exception as e:  # noqa: BLE001
        log.exception("analysis %s failed", job_id)
        job_store.fail(job_id, str(e))


@router.post("/analyses")
def create_analysis(
    body: CreateAnalysis,
    background: BackgroundTasks,
    settings: Settings = Depends(get_settings),
) -> dict:
    video_path = None
    if body.mode == "full":
        if not settings.ball_model_path:
            raise HTTPException(
                400,
                "full mode needs tennis-ball YOLO weights: set TENNIS_BALL_MODEL_PATH "
                "(see README); demo mode works without any weights",
            )
        if not body.video_id:
            raise HTTPException(400, "video_id is required for full mode")
        matches = sorted(settings.videos_dir.glob(f"{body.video_id}_*"))
        if not matches:
            raise HTTPException(404, "video not found")
        video_path = matches[0]
    elif body.mode == "youtube":
        if not youtube.is_available():
            raise HTTPException(400, "youtube mode needs yt-dlp: pip install yt-dlp (see README)")
        if not body.youtube_url or not youtube.parse_youtube_url(body.youtube_url):
            raise HTTPException(
                400, "youtube_url must be a YouTube link (watch / youtu.be / shorts)"
            )
        if not settings.ball_model_path and not settings.llm_enabled:
            raise HTTPException(
                400,
                "youtube mode needs an analysis engine: set TENNIS_BALL_MODEL_PATH "
                "(full detection pipeline) or TENNIS_OPENAI_API_KEY (AI vision review)",
            )
    elif body.mode != "demo":
        raise HTTPException(400, "mode must be 'demo', 'full' or 'youtube'")

    job = job_store.create(
        mode=body.mode,
        video_id=body.video_id,
        stages=YOUTUBE_STAGES if body.mode == "youtube" else None,
    )
    background.add_task(_run_job, settings, job.id, video_path, body.youtube_url)
    return {"analysis_id": job.id, "status": job.status.value}


def _created_at_ts(v) -> float:
    """created_at arrives as a unix float (jobs) or ISO string (persisted)."""
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return datetime.fromisoformat(v).timestamp()
    except ValueError:
        return 0.0


@router.get("/analyses")
def list_analyses(settings: Settings = Depends(get_settings)) -> list[dict]:
    # Persisted results keep the history alive across restarts; in-memory
    # jobs add live state (running/failed) and override their own entries.
    out: dict[str, dict] = {}
    for result in storage.list_analyses(settings):
        out[result.id] = {
            "id": result.id,
            "mode": result.mode,
            "status": JobStatus.DONE.value,
            "created_at": result.created_at,
            "points": result.stats.points,
            "patterns": len(result.patterns),
            "title": result.source,
            "source_url": result.source_url,
        }
    for job in job_store.list():
        summary = {
            "id": job.id,
            "mode": job.mode,
            "status": job.status.value,
            "created_at": job.created_at,
        }
        if job.status == JobStatus.DONE and job.result is not None:
            summary.update(
                {
                    "points": job.result.stats.points,
                    "patterns": len(job.result.patterns),
                    "title": job.result.source,
                    "source_url": job.result.source_url,
                }
            )
        out[job.id] = summary
    entries = sorted(out.values(), key=lambda e: -_created_at_ts(e["created_at"]))
    return entries


@router.get("/analyses/{analysis_id}")
def get_analysis(analysis_id: str, settings: Settings = Depends(get_settings)) -> dict:
    job = job_store.get(analysis_id)
    if job is not None:
        payload = job.as_dict()
        if job.result is not None:
            payload["result"] = job.result.model_dump()
        return payload
    result = _get_result_or_404(analysis_id, settings)  # persisted, server restarted
    return {
        "id": analysis_id,
        "mode": result.mode,
        "status": JobStatus.DONE.value,
        "stages": [],
        "result": result.model_dump(),
    }


@router.get("/analyses/{analysis_id}/rallies")
def get_rallies(analysis_id: str, settings: Settings = Depends(get_settings)) -> dict:
    result = _get_result_or_404(analysis_id, settings)
    return {
        "id": result.id,
        "players": result.players,
        "rallies": [r.model_dump() for r in result.rallies],
    }


@router.get("/analyses/{analysis_id}/patterns")
def get_patterns(analysis_id: str, settings: Settings = Depends(get_settings)) -> dict:
    result = _get_result_or_404(analysis_id, settings)
    return {"id": result.id, "patterns": [p.model_dump() for p in result.patterns]}


# ---------------------------------------------------------------------------
# Coach chat
# ---------------------------------------------------------------------------

class ChatMessage(BaseModel):
    message: str


@router.post("/analyses/{analysis_id}/chat")
def chat(
    analysis_id: str,
    body: ChatMessage,
    settings: Settings = Depends(get_settings),
) -> dict:
    result = _get_result_or_404(analysis_id, settings)
    if not body.message.strip():
        raise HTTPException(400, "empty message")
    from app.services.llm import chat as llm_chat

    history = storage.load_chat_history(settings, analysis_id)
    try:
        answer = llm_chat.answer_question(result, history, body.message, settings)
    except Exception as e:  # noqa: BLE001
        log.exception("chat failed")
        raise HTTPException(502, f"chat backend error: {e}") from e
    history += [
        {"role": "user", "content": body.message},
        {"role": "assistant", "content": answer},
    ]
    storage.save_chat_history(settings, analysis_id, history)
    return {"answer": answer, "llm": settings.llm_enabled}


# ---------------------------------------------------------------------------
# Tour（职业巡回赛资料库 / 球探报告）
# ---------------------------------------------------------------------------

@router.get("/tour/status")
def tour_status(settings: Settings = Depends(get_settings)) -> dict:
    path = _tour_db_path(settings)
    if not path.exists():
        return {"built": False}
    conn = _tour_conn(settings)
    meta = {r["key"]: r["value"] for r in conn.execute("SELECT * FROM meta")}
    counts = conn.execute(
        "SELECT (SELECT COUNT(*) FROM matches) AS matches, "
        "(SELECT COUNT(*) FROM players) AS players, "
        "(SELECT COUNT(*) FROM elo) AS elo"
    ).fetchone()
    return {"built": True, **dict(counts), **meta}


@router.get("/tour/players")
def tour_players(
    q: str,
    tour: str | None = None,
    limit: int = 20,
    settings: Settings = Depends(get_settings),
) -> list[dict]:
    conn = _tour_conn(settings)
    hits = tour_scouting.search_players(conn, q, min(limit, 50))
    if tour:
        hits = [h for h in hits if h["tour"] == tour]
    return hits


@router.get("/tour/players/{player_id}")
def tour_player(
    player_id: int,
    tour: str = "atp",
    settings: Settings = Depends(get_settings),
) -> dict:
    conn = _tour_conn(settings)
    core = tour_scouting.player_core(conn, player_id, tour)
    if not core:
        raise HTTPException(404, "player not found")
    recent = metrics_recent(conn, player_id, tour)
    core["recent_matches"] = recent
    return core


def metrics_recent(conn, player_id: int, tour: str, n: int = 10) -> list[dict]:
    from app.tour import metrics as tour_metrics

    ms = tour_metrics.player_matches(
        conn, player_id, tour_metrics.MatchFilter(tour=tour)
    )[:n]
    return [
        {
            "date": m["date"], "tournament": m["tourney_name"], "surface": m["surface"],
            "won": bool(m["won"]), "score": m["score"], "opponent": m["opp_name"],
        }
        for m in ms
    ]


@router.get("/tour/tournaments")
def tour_tournaments(
    tour: str | None = None, settings: Settings = Depends(get_settings)
) -> list[dict]:
    conn = _tour_conn(settings)
    ts = tour_scouting.tournaments(conn)
    if tour:
        ts = [t for t in ts if t["tour"] == tour]
    return ts[:200]


class ScoutingRequest(BaseModel):
    opponent_id: int
    tour: str = "atp"                       # player_id 跨巡回赛不唯一
    client_id: int | None = None            # 我方球员（生成 H2H）
    client_tour: str | None = None          # 默认同巡回赛
    surface: Optional[str] = None           # Clay / Hard / Grass
    tournament_id: Optional[str] = None     # 指定赛事（自动带出场地）
    months: int = 12                        # 统计窗口
    include_secondary: bool = False         # 纳入挑战赛/ITF


@router.post("/tour/scouting")
def tour_scouting_report(
    body: ScoutingRequest, settings: Settings = Depends(get_settings)
) -> dict:
    if body.surface and body.surface not in ("Clay", "Hard", "Grass", "Carpet"):
        raise HTTPException(400, "surface must be Clay/Hard/Grass/Carpet")
    if body.tour not in ("atp", "wta"):
        raise HTTPException(400, "tour must be atp or wta")
    _tour_conn(settings)  # 503 if not built
    try:
        report = tour_scouting.build_report(
            _tour_db_path(settings),
            opponent_id=body.opponent_id,
            tour=body.tour,
            client_id=body.client_id,
            surface=body.surface,
            tournament_id=body.tournament_id,
            months=body.months,
            include_secondary=body.include_secondary,
        )
    except KeyError as e:
        raise HTTPException(404, str(e)) from e
    return report
