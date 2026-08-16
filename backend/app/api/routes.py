"""HTTP API surface."""

from __future__ import annotations

import logging
import re
import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.domain.events import AnalysisResult
from app.services import pipeline, storage
from app.services.jobs import JobStatus, job_store

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

_SAFE_NAME = re.compile(r"[^A-Za-z0-9_.-]")


@router.get("/health")
def health(settings: Settings = Depends(get_settings)) -> dict:
    return {
        "status": "ok",
        "version": settings.version,
        "llm_enabled": settings.llm_enabled,
        "full_mode_ready": bool(settings.ball_model_path),
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
    mode: str = "demo"  # "demo" | "full"


def _get_result_or_404(analysis_id: str, settings: Settings) -> AnalysisResult:
    result = storage.load_analysis(settings, analysis_id)
    if result is None:
        raise HTTPException(404, "analysis not found")
    return result


def _run_job(settings: Settings, job_id: str, video_path=None) -> None:
    job = job_store.get(job_id)
    if job is None:
        return
    try:
        if job.mode == "demo":
            result = pipeline.run_demo_analysis(settings, job)
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
    elif body.mode != "demo":
        raise HTTPException(400, "mode must be 'demo' or 'full'")

    job = job_store.create(mode=body.mode, video_id=body.video_id)
    background.add_task(_run_job, settings, job.id, video_path)
    return {"analysis_id": job.id, "status": job.status.value}


@router.get("/analyses")
def list_analyses(settings: Settings = Depends(get_settings)) -> list[dict]:
    out = []
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
                }
            )
        out.append(summary)
    return out


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
