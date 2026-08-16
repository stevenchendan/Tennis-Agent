"""Core domain types shared across the analysis pipeline and the API.

Court coordinate convention (meters, top-down):
    x in [0, 10.97]  -- 0 = left sideline, 10.97 = right sideline (doubles width)
    y in [0, 23.77]  -- 0 = near (bottom) baseline, 23.77 = far (top) baseline
    net at y = 11.885

Player 1 occupies the near half (y < net), player 2 the far half.
"""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

CourtPoint = tuple[float, float]
Bbox = tuple[float, float, float, float]


class CourtHalf(str, Enum):
    NEAR = "near"
    FAR = "far"


class CourtSide(str, Enum):
    """Deuce/ad court from the hitting player's perspective."""

    DEUCE = "deuce"
    AD = "ad"


class ShotZone(str, Enum):
    """Depth zone of a position along the court length axis."""

    SERVICE = "service"  # inside the service boxes
    MID = "mid"  # between service line and baseline area
    DEEP = "deep"  # near/behind the baseline
    FRONT = "front"  # inside `front_zone_m_from_net` (net area)


class ShotDirection(str, Enum):
    """Direction of a shot relative to the hitter's court position."""

    CROSS = "cross"
    LINE = "line"
    MIDDLE = "middle"


class BallEventKind(str, Enum):
    HIT = "hit"
    BOUNCE = "bounce"


class BallPosition(BaseModel):
    frame: int
    court: CourtPoint
    interpolated: bool = False


class FrameDetections(BaseModel):
    """Per-frame detections, in pixels and (when available) court coords.

    Court coordinates may come from the court-keypoint homography (YOLO
    pipeline) or directly from the demo fixture generator.
    """

    frame: int
    players: dict[int, Bbox] = Field(default_factory=dict)
    ball: Optional[Bbox] = None
    players_court: dict[int, CourtPoint] = Field(default_factory=dict)
    ball_court: Optional[CourtPoint] = None


class Shot(BaseModel):
    index: int  # index within the rally
    frame: int
    time_s: float
    player_id: int
    is_serve: bool = False
    is_volley: bool = False
    hit_position: CourtPoint
    landing_position: Optional[CourtPoint] = None
    side: Optional[CourtSide] = None  # deuce/ad court of the hitter
    zone: Optional[ShotZone] = None
    direction: Optional[ShotDirection] = None
    # speed of outgoing ball in km/h (court-planar projection; approximate)
    speed_kmh: Optional[float] = None


class Rally(BaseModel):
    id: int
    start_frame: int
    end_frame: int
    server: int
    serve_side: CourtSide
    shots: list[Shot] = Field(default_factory=list)
    winner: Optional[int] = None
    end_reason: Optional[str] = None  # e.g. "double_bounce", "no_return", "truncated"
    # confidence in the inferred winner, 0..1 (heuristic)
    winner_confidence: float = 0.0

    @property
    def length(self) -> int:
        return len(self.shots)


class PatternCategory(str, Enum):
    SERVE = "serve"
    SERVE_PLUS_ONE = "serve_plus_one"
    RALLY = "rally"
    DIRECTION = "direction"
    POSITION = "position"


class PatternCard(BaseModel):
    """A mined tactical pattern, presented as an evidence-backed card."""

    code: str
    category: PatternCategory
    title: str
    description: str
    player_id: Optional[int] = None
    support: int  # number of points/shots backing the pattern
    confidence: float  # 0..1
    evidence_rally_ids: list[int] = Field(default_factory=list)
    takeaway: str  # actionable advice for the user's own game


class MatchStats(BaseModel):
    points: int = 0
    points_won: dict[int, int] = Field(default_factory=dict)
    shots: dict[int, int] = Field(default_factory=dict)
    volleys: dict[int, int] = Field(default_factory=dict)
    aces_inferred: dict[int, int] = Field(default_factory=dict)
    avg_rally_length: float = 0.0
    longest_rally: int = 0
    direction_counts: dict[int, dict[str, int]] = Field(default_factory=dict)


class AnalysisResult(BaseModel):
    id: str
    created_at: str
    source: str  # video filename, "demo", or the YouTube video title
    mode: str  # "demo" | "full" | "youtube"
    # YouTube review provenance (null for uploads/demo).
    source_url: Optional[str] = None
    source_title: Optional[str] = None
    fps: float
    players: dict[int, str] = Field(default_factory=dict)
    rallies: list[Rally] = Field(default_factory=list)
    patterns: list[PatternCard] = Field(default_factory=list)
    stats: MatchStats = Field(default_factory=MatchStats)
    report: Optional[str] = None  # markdown tactical report
    report_generated_by: Optional[str] = None  # "llm" | "heuristic"
    court_mapping: str = "homography"  # or "proxy" / "fixture"
    notes: list[str] = Field(default_factory=list)
