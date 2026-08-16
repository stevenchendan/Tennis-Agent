"""YouTube ingestion: parse links, probe metadata, download via yt-dlp.

Downloads are capped at 720p progressive mp4 so no ffmpeg merge step is
needed. Intended for reviewing your own match recordings; respect
YouTube's terms of service.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

_VIDEO_ID = r"[A-Za-z0-9_-]{11}"
_YOUTUBE_HOST = re.compile(r"^(?:https?://)?(?:www\.|m\.)?youtube\.com/", re.IGNORECASE)
_WATCH_ID = re.compile(rf"[?&]v=({_VIDEO_ID})")
_PATH_ID = re.compile(rf"/(?:shorts|embed|live)/({_VIDEO_ID})")
_SHORT_HOST = re.compile(rf"^(?:https?://)?youtu\.be/({_VIDEO_ID})(?:[?#].*)?$", re.IGNORECASE)


class YouTubeError(RuntimeError):
    """User-facing ingestion failure (bad link, private video, ...)."""


@dataclass
class VideoInfo:
    id: str
    title: str
    duration_s: int | None = None
    uploader: str | None = None


def parse_youtube_url(url: str) -> str | None:
    """Return the 11-char video id for supported YouTube link forms."""
    u = (url or "").strip()
    if not u:
        return None
    if _YOUTUBE_HOST.match(u):
        m = _WATCH_ID.search(u) or _PATH_ID.search(u)
        return m.group(1) if m else None
    m = _SHORT_HOST.match(u)
    return m.group(1) if m else None


def is_available() -> bool:
    try:
        import yt_dlp  # noqa: F401
    except ImportError:
        return False
    return True


def _friendly_error(msg: str) -> str:
    m = msg.lower()
    if "private" in m:
        return "this YouTube video is private and cannot be downloaded"
    if "age" in m or "sign in" in m:
        return "this YouTube video requires sign-in (age-restricted) and cannot be downloaded"
    if "unavailable" in m or "not available" in m or "removed" in m:
        return "this YouTube video is unavailable (removed or region-locked)"
    if "not a bot" in m or "cookies" in m:
        return "YouTube blocked the download (bot check): update yt-dlp or configure cookies"
    first = msg.strip().splitlines()[0] if msg.strip() else "unknown error"
    return f"YouTube download failed: {first[:200]}"


def _ydl_options() -> dict:
    return {
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "socket_timeout": 20,
        # Be honest about what we are; some clients get blocked otherwise.
        "http_headers": {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
    }


def _to_info(raw: dict) -> VideoInfo:
    return VideoInfo(
        id=str(raw.get("id") or ""),
        title=str(raw.get("title") or "(untitled)"),
        duration_s=int(raw["duration"]) if raw.get("duration") else None,
        uploader=raw.get("uploader"),
    )


def probe(url: str) -> VideoInfo:
    """Fetch metadata without downloading. Raises YouTubeError."""
    import yt_dlp

    try:
        with yt_dlp.YoutubeDL(_ydl_options()) as ydl:
            raw = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        raise YouTubeError(_friendly_error(str(e))) from e
    if raw is None:
        raise YouTubeError("YouTube returned no video info")
    if raw.get("_type") == "playlist":
        entries = raw.get("entries") or []
        if not entries:
            raise YouTubeError("this YouTube link points to an empty playlist")
        raw = entries[0]
    return _to_info(raw)


def download(
    url: str,
    dest_dir: Path,
    stem: str,
    max_height: int = 720,
    on_progress: Callable[[str], None] | None = None,
) -> tuple[Path, VideoInfo]:
    """Download a progressive mp4 (<= max_height, no ffmpeg needed).

    Returns (local_path, info). Raises YouTubeError."""
    import yt_dlp

    dest_dir.mkdir(parents=True, exist_ok=True)

    def hook(d: dict) -> None:
        if on_progress is None:
            return
        if d.get("status") == "downloading":
            done = d.get("downloaded_bytes") or 0
            total = d.get("total_bytes") or d.get("total_bytes_estimate")
            if total:
                on_progress(f"{min(done / total, 1.0):.0%}")
        elif d.get("status") == "finished":
            on_progress("100%")

    opts = _ydl_options()
    opts.update(
        {
            # "b" = best single-file (progressive) format: video+audio, no merge
            "format": f"b[height<={max_height}][ext=mp4]/b[height<={max_height}]/b",
            "outtmpl": str(dest_dir / f"{stem}.%(ext)s"),
            "progress_hooks": [hook],
        }
    )
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            raw = ydl.extract_info(url, download=True)
    except yt_dlp.utils.DownloadError as e:
        raise YouTubeError(_friendly_error(str(e))) from e
    if raw is None:
        raise YouTubeError("YouTube returned no video info")
    path = Path(ydl.prepare_filename(raw))
    if not path.exists():
        raise YouTubeError(f"download finished but file is missing: {path.name}")
    return path, _to_info(raw)
