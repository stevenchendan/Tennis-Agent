"""Pipeline orchestration: raw detections -> rallies -> patterns -> report.

Demo mode runs the identical event/tactics/report stages on a synthetic
match, so the whole product is exercisable without weights or GPU.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from app.core.config import Settings
from app.domain.events import AnalysisResult, FrameDetections
from app.services import fixtures, storage
from app.services.analysis import court_geometry as cg
from app.services.analysis import events, patterns
from app.services.jobs import AnalysisJob, JobStatus, StageStatus
from app.services.llm import report as llm_report

log = logging.getLogger(__name__)


def _set_stage(job: AnalysisJob, name: str, status: StageStatus, detail: str = "") -> None:
    st = job.stage(name)
    st.status = status
    if detail:
        st.detail = detail
    log.info("analysis %s stage=%s status=%s %s", job.id, name, status.value, detail)


def run_demo_analysis(settings: Settings, job: AnalysisJob) -> AnalysisResult:
    job.status = JobStatus.RUNNING
    _set_stage(job, "ingest", StageStatus.RUNNING, "generating synthetic match")
    frames, fps = fixtures.generate_demo_match()
    _set_stage(job, "ingest", StageStatus.DONE, f"{len(frames)} frames @ {fps} fps")

    _set_stage(job, "detect", StageStatus.SKIPPED, "demo mode: detections come from the fixture")
    _set_stage(job, "map", StageStatus.SKIPPED, "demo mode: court coordinates provided by the fixture")

    result = _run_tactical_stages(settings, job, frames, fps, source="demo", mode="demo", court_mapping="fixture")
    return result


def run_full_analysis(settings: Settings, job: AnalysisJob, video_path: Path) -> AnalysisResult:
    from app.services.detection import yolo

    job.status = JobStatus.RUNNING

    _set_stage(job, "ingest", StageStatus.RUNNING, str(video_path.name))
    meta = yolo.read_video_meta(video_path)
    _set_stage(job, "ingest", StageStatus.DONE, f"{meta.n_frames} frames @ {meta.fps:.1f} fps")

    _set_stage(job, "detect", StageStatus.RUNNING, "players + ball")
    frames, _ = yolo.detect_frames(video_path, settings, on_progress=lambda i, n: _set_stage(job, "detect", StageStatus.RUNNING, f"frame {i}/{n}"))
    _set_stage(job, "detect", StageStatus.DONE, f"{len(frames)} frames detected")

    _set_stage(job, "map", StageStatus.RUNNING, "court mapping")
    notes: list[str] = []
    court_mapping = "proxy"
    H = None
    if settings.court_model_path:
        try:
            first = next(yolo.iter_frames(video_path), None)
            if first is not None:
                court = yolo.CourtKeypointDetector(settings.court_model_path)
                kps = court.predict(first[1])
                H = cg.build_homography(kps)
                if H is not None:
                    court_mapping = "homography"
        except Exception as e:  # noqa: BLE001 - degrade, don't die
            notes.append(f"court model failed ({e}); falling back to proxy mapping")
    if H is None:
        H = cg.proxy_court_from_detections(frames)
        if H is None:
            raise RuntimeError(
                "could not establish a court mapping from this video "
                "(too few detections); see docs for camera guidance"
            )
        notes.append(
            "proxy court mapping (no court keypoint model): zones are "
            "approximate; set TENNIS_COURT_MODEL_PATH for precise geometry"
        )
    for f in frames:
        if not f.players_court:
            cg.proxy_map_frame(f, H)
    _set_stage(job, "map", StageStatus.DONE, court_mapping)

    result = _run_tactical_stages(
        settings, job, frames, meta.fps, source=video_path.name, mode="full", court_mapping=court_mapping, notes=notes
    )
    return result


def _run_tactical_stages(
    settings: Settings,
    job: AnalysisJob,
    frames: list[FrameDetections],
    fps: float,
    source: str,
    mode: str,
    court_mapping: str,
    notes: list[str] | None = None,
) -> AnalysisResult:
    _set_stage(job, "events", StageStatus.RUNNING, "ball interpolation")
    events.interpolate_ball(frames)

    _set_stage(job, "events", StageStatus.RUNNING, "hit candidates")
    candidates = events.hit_candidates(frames, min_sustained=settings.min_sustained_frames)
    hits = events.confirm_hits(frames, candidates, radius_m=settings.hit_player_radius_m)
    bounces = events.detect_bounces(frames, speed_ratio=settings.bounce_speed_ratio)
    if len(hits) < 4:
        raise RuntimeError(
            f"only {len(hits)} confirmed hits detected -- tracking quality too low "
            "for tactical analysis (check ball model / camera angle)"
        )
    _set_stage(job, "events", StageStatus.DONE, f"{len(hits)} hits, {len(bounces)} bounces")

    _set_stage(job, "tactics", StageStatus.RUNNING)
    rallies = events.build_rallies(frames, fps, hits, bounces, gap_frames=settings.rally_gap_frames)
    pattern_cards = patterns.mine_all(rallies, min_support=settings.min_pattern_support)
    stats = patterns.compute_stats(rallies)
    _set_stage(job, "tactics", StageStatus.DONE, f"{len(rallies)} rallies, {len(pattern_cards)} patterns")

    result = AnalysisResult(
        id=job.id,  # job id is the public analysis id across the API
        created_at=datetime.now(timezone.utc).isoformat(),
        source=source,
        mode=mode,
        fps=fps,
        players={1: "Player 1 (near)", 2: "Player 2 (far)"},
        rallies=rallies,
        patterns=pattern_cards,
        stats=stats,
        court_mapping=court_mapping,
        notes=notes or [],
    )

    _set_stage(job, "report", StageStatus.RUNNING)
    try:
        result.report, result.report_generated_by = llm_report.generate_report(result, settings)
        _set_stage(job, "report", StageStatus.DONE, f"via {result.report_generated_by}")
    except Exception as e:  # noqa: BLE001
        log.exception("report generation failed")
        result.notes.append(f"report generation failed: {e}")
        _set_stage(job, "report", StageStatus.FAILED, str(e))

    storage.save_analysis(settings, result)
    return result
