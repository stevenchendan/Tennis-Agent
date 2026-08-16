"""In-memory job registry with persisted final results.

Pipeline stages: queued -> ingesting -> detecting -> mapping -> events
-> tactics -> reporting -> done | failed.

Upgrade path (documented in ARCHITECTURE.md): swap this for
Celery/RQ + Redis when analysis moves off the web process.
"""

from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

from app.domain.events import AnalysisResult


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


STAGES = ["ingest", "detect", "map", "events", "tactics", "report"]


class StageStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class Stage:
    name: str
    status: StageStatus = StageStatus.PENDING
    detail: str = ""

    def as_dict(self) -> dict[str, Any]:
        return {"name": self.name, "status": self.status.value, "detail": self.detail}


@dataclass
class AnalysisJob:
    id: str
    mode: str  # "demo" | "full"
    video_id: Optional[str] = None
    status: JobStatus = JobStatus.QUEUED
    stages: list[Stage] = field(default_factory=lambda: [Stage(n) for n in STAGES])
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None
    result: Optional[AnalysisResult] = None

    def stage(self, name: str) -> Stage:
        return next(s for s in self.stages if s.name == name)

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "mode": self.mode,
            "video_id": self.video_id,
            "status": self.status.value,
            "stages": [s.as_dict() for s in self.stages],
            "error": self.error,
            "created_at": self.created_at,
            "finished_at": self.finished_at,
        }


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, AnalysisJob] = {}
        self._lock = threading.Lock()

    def create(self, mode: str, video_id: Optional[str] = None) -> AnalysisJob:
        job = AnalysisJob(id=uuid.uuid4().hex[:12], mode=mode, video_id=video_id)
        with self._lock:
            self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> AnalysisJob | None:
        with self._lock:
            return self._jobs.get(job_id)

    def list(self) -> list[AnalysisJob]:
        with self._lock:
            return sorted(self._jobs.values(), key=lambda j: -j.created_at)

    def attach_result(self, job_id: str, result: AnalysisResult) -> None:
        job = self.get(job_id)
        if job:
            job.result = result
            job.status = JobStatus.DONE
            job.finished_at = time.time()

    def fail(self, job_id: str, error: str) -> None:
        job = self.get(job_id)
        if job:
            job.status = JobStatus.FAILED
            job.error = error
            job.finished_at = time.time()


# Process-wide singleton; FastAPI deps can override for tests.
job_store = JobStore()
