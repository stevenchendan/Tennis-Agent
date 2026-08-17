"""Pipeline orchestration: raw detections -> rallies -> patterns -> report.

Demo mode runs the identical event/tactics/report stages on a synthetic
match, so the whole product is exercisable without weights or GPU.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

import numpy as np

from app.core.config import Settings
from app.domain.events import AnalysisResult, FrameDetections
from app.services import fixtures, storage
from app.services.analysis import court_geometry as cg
from app.services.analysis import events, patterns
from app.services.jobs import AnalysisJob, JobStatus, StageStatus
from app.services.llm import report as llm_report

if TYPE_CHECKING:
    from app.services.youtube import VideoInfo

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
    job.status = JobStatus.RUNNING
    frames, fps, court_mapping, notes = _run_detection_stages(settings, job, video_path)
    return _run_tactical_stages(
        settings, job, frames, fps, source=video_path.name, mode="full", court_mapping=court_mapping, notes=notes
    )


def run_youtube_analysis(settings: Settings, job: AnalysisJob, url: str) -> AnalysisResult:
    """Download a YouTube match video, then analyze it with the best
    available engine: the CV pipeline when YOLO weights are configured,
    otherwise a multimodal LLM vision review."""
    from app.services import youtube

    job.status = JobStatus.RUNNING

    _set_stage(job, "download", StageStatus.RUNNING, "fetching video info")
    info = youtube.probe(url)
    limit_min = settings.youtube_max_duration_min
    if limit_min and info.duration_s and info.duration_s > limit_min * 60:
        raise youtube.YouTubeError(
            f"video is {info.duration_s // 60} min long; the limit is {limit_min} min "
            "(TENNIS_YOUTUBE_MAX_DURATION_MIN)"
        )
    stem = f"{uuid.uuid4().hex[:12]}_yt_{info.id}"
    _set_stage(job, "download", StageStatus.RUNNING, info.title)
    path, _ = youtube.download(
        url,
        settings.videos_dir,
        stem=stem,
        on_progress=lambda p: _set_stage(job, "download", StageStatus.RUNNING, f"{info.title} · {p}"),
    )
    _set_stage(job, "download", StageStatus.DONE, info.title)

    if settings.ball_model_path:
        job.engine = "cv"
        frames, fps, court_mapping, notes = _run_detection_stages(settings, job, path)
        return _run_tactical_stages(
            settings,
            job,
            frames,
            fps,
            source=f"YouTube · {info.title}",
            mode="youtube",
            court_mapping=court_mapping,
            notes=notes,
            source_url=url,
            source_title=info.title,
        )
    return _run_vision_review(settings, job, path, url, info)


def _run_detection_stages(
    settings: Settings, job: AnalysisJob, video_path: Path
) -> tuple[list[FrameDetections], float, str, list[str]]:
    """ingest + detect + map stages; returns (frames, fps, court_mapping, notes)."""
    from app.services.detection import yolo

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
    return frames, meta.fps, court_mapping, notes


def _run_vision_review(
    settings: Settings, job: AnalysisJob, video_path: Path, url: str, info: VideoInfo
) -> AnalysisResult:
    """LLM-only review: no per-shot data, the report is the product."""
    job.engine = "llm_vision"
    skip = "AI vision review (no YOLO weights): no per-shot data"
    for stage in ("ingest", "detect", "map", "events", "tactics"):
        _set_stage(job, stage, StageStatus.SKIPPED, skip)

    _set_stage(job, "report", StageStatus.RUNNING, f"sampling {settings.review_frame_count} frames")
    from app.services.llm import vision

    report = vision.generate_review(video_path, settings, info.title)
    _set_stage(job, "report", StageStatus.DONE, "via llm_vision")

    result = AnalysisResult(
        id=job.id,
        created_at=datetime.now(timezone.utc).isoformat(),
        source=f"YouTube · {info.title}",
        mode="youtube",
        source_url=url,
        source_title=info.title,
        fps=0.0,
        players={1: "Player 1 (near)", 2: "Player 2 (far)"},
        rallies=[],
        patterns=[],
        court_mapping="none",
        notes=[
            "AI 视觉复盘（未配置 YOLO 权重）：不含逐拍数据与模式卡片；"
            "设置 TENNIS_BALL_MODEL_PATH 后可获得完整检测分析。"
        ],
        report=report,
        report_generated_by="llm_vision",
    )
    storage.save_analysis(settings, result)
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
    source_url: str | None = None,
    source_title: str | None = None,
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
        source_url=source_url,
        source_title=source_title,
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
