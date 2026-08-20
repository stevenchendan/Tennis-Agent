"""Application settings, loaded from environment with TENNIS_ prefix (or .env)."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="TENNIS_", env_file=".env", extra="ignore"
    )

    app_name: str = "Tennis-Agent API"
    version: str = "0.1.0"

    # Storage layout: data/{videos,analyses}
    data_dir: Path = BACKEND_DIR / "data"

    # --- Model weights -------------------------------------------------
    # YOLO weights for players. Any ultralytics-resolvable name/path.
    player_model_path: str = "yolov8n.pt"
    # Custom tennis-ball YOLO weights (e.g. the Roboflow tennis-ball model).
    # Empty string disables full-video mode; demo mode still works.
    ball_model_path: str = ""
    # Optional ResNet court-keypoint weights (.pth, 14 keypoints).
    # Without it, full mode falls back to a player/ball-fitted proxy court
    # (coarser zones; the analysis flags this).
    court_model_path: str = ""

    # --- Detection thresholds -------------------------------------------
    player_conf: float = 0.5
    ball_conf: float = 0.15
    # A ball bbox is plausible only in this size/aspect window (pixels).
    ball_min_size: float = 4.0
    ball_max_size: float = 45.0
    ball_aspect_min: float = 0.6
    ball_aspect_max: float = 1.5

    # --- Event engine (court coordinates are meters) ---------------------
    # A sustained y-direction reversal of the ball in court coordinates is
    # a hit candidate; a hit is confirmed when the ball is within this
    # radius of a player at that frame.
    hit_player_radius_m: float = 2.4
    # Reversal must persist at least this many frames to reject jitter.
    min_sustained_frames: int = 4
    # Ball speed step-down (after/before mean-step ratio) below this flags a bounce.
    bounce_speed_ratio: float = 0.5
    # A gap longer than this many frames between confirmed hits starts a
    # new rally (~3s at 25fps).
    rally_gap_frames: int = 80
    # Volley: hitter contact happened before the ball bounced since the
    # opponent's hit, and contact is inside the front zone.
    front_zone_m_from_net: float = 5.0

    # --- Pattern mining ---------------------------------------------------
    min_pattern_support: int = 3

    # --- YouTube review ---------------------------------------------------
    # Reject videos longer than this before downloading (0 = no limit).
    youtube_max_duration_min: int = 90
    # Frames sampled evenly across the video for the LLM vision review
    # (used when no YOLO weights are configured).
    review_frame_count: int = 24

    # --- LLM ----------------------------------------------------------
    openai_api_key: str = ""
    openai_base_url: str | None = None
    llm_model: str = "gpt-4o-mini"
    llm_temperature: float = 0.3

    # --- UTR Engage API -------------------------------------------------
    # Credentials are supplied only after an approved UTR developer application.
    utr_client_id: str = ""
    utr_client_secret: str = ""
    utr_redirect_uri: str = ""

    # CORS for the Next.js dev server (and common alt ports).
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def llm_enabled(self) -> bool:
        return bool(self.openai_api_key)

    @property
    def utr_configured(self) -> bool:
        return bool(self.utr_client_id and self.utr_client_secret and self.utr_redirect_uri)

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def videos_dir(self) -> Path:
        return self.data_dir / "videos"

    @property
    def analyses_dir(self) -> Path:
        return self.data_dir / "analyses"

    def ensure_dirs(self) -> None:
        self.videos_dir.mkdir(parents=True, exist_ok=True)
        self.analyses_dir.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    s.ensure_dirs()
    return s
