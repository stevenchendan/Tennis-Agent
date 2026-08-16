"""Analysis result persistence: data/analyses/{id}.json (+ chat history)."""

from __future__ import annotations

import json
from pathlib import Path

from app.core.config import Settings
from app.domain.events import AnalysisResult


def save_analysis(settings: Settings, result: AnalysisResult) -> Path:
    settings.analyses_dir.mkdir(parents=True, exist_ok=True)
    path = settings.analyses_dir / f"{result.id}.json"
    path.write_text(result.model_dump_json(indent=2), encoding="utf-8")
    return path


def load_analysis(settings: Settings, analysis_id: str) -> AnalysisResult | None:
    path = settings.analyses_dir / f"{analysis_id}.json"
    if not path.exists():
        return None
    return AnalysisResult.model_validate_json(path.read_text(encoding="utf-8"))


def list_analyses(settings: Settings) -> list[AnalysisResult]:
    out = []
    for path in sorted(settings.analyses_dir.glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            out.append(AnalysisResult.model_validate_json(path.read_text(encoding="utf-8")))
        except Exception:  # tolerate corrupt files
            continue
    return out


def load_chat_history(settings: Settings, analysis_id: str) -> list[dict]:
    path = settings.analyses_dir / f"{analysis_id}.chat.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def save_chat_history(settings: Settings, analysis_id: str, history: list[dict]) -> None:
    settings.analyses_dir.mkdir(parents=True, exist_ok=True)
    path = settings.analyses_dir / f"{analysis_id}.chat.json"
    path.write_text(json.dumps(history[-40:], ensure_ascii=False, indent=2), encoding="utf-8")
