"""Court geometry: constants, zone/side/direction classification, homography.

Standard court dimensions (ITF):
    - doubles width 10.97 m, singles width 8.23 m
    - length 23.77 m, service line 6.40 m from the net on each side
    - net at the middle of the length axis
"""

from __future__ import annotations

import cv2
import numpy as np

from app.domain.events import Bbox, CourtHalf, CourtPoint, CourtSide, ShotDirection, ShotZone

COURT_LENGTH = 23.77
COURT_WIDTH = 10.97  # doubles
SINGLES_WIDTH = 8.23
SINGLES_MARGIN = (COURT_WIDTH - SINGLES_WIDTH) / 2  # 1.37 m alley each side
NET_Y = COURT_LENGTH / 2  # 11.885
SERVICE_DEPTH = 6.40  # distance from net to service line
CENTER_X = COURT_WIDTH / 2

SERVICE_LINE_NEAR = NET_Y - SERVICE_DEPTH  # 5.485
SERVICE_LINE_FAR = NET_Y + SERVICE_DEPTH  # 18.285
BASELINE_NEAR = 0.0
BASELINE_FAR = COURT_LENGTH

# Depth zone band around the baseline where players typically contact the ball.
DEEP_BAND = 1.5


def half_of(y: float) -> CourtHalf:
    return CourtHalf.NEAR if y < NET_Y else CourtHalf.FAR


def player_half(player_id: int) -> CourtHalf:
    """Player 1 = near half, player 2 = far half (fixed assignment)."""
    return CourtHalf.NEAR if player_id == 1 else CourtHalf.FAR


def side_for(player_id: int, x: float) -> CourtSide:
    """Deuce/ad court of a position, from the hitting player's perspective.

    Camera behind the near player: the near player's right is screen right.
    The deuce court is each player's right as they face the net, so it is
    screen right for the near player and screen left for the far player.
    """
    near_right = x >= CENTER_X
    if player_id == 1:
        return CourtSide.DEUCE if near_right else CourtSide.AD
    return CourtSide.AD if near_right else CourtSide.DEUCE


def zone_for(y: float) -> ShotZone:
    """Depth zone of a position along the court length axis.

    Near side (mirrored on the far side):
        DEEP    y < 2.0            baseline band
        MID     2.0 .. 5.485       no-man's land
        SERVICE 5.485 .. 9.385     inside the service box
        FRONT   within 2.5 m of the net
    """
    if abs(y - NET_Y) < 2.5:
        return ShotZone.FRONT
    if y < NET_Y:
        if y < 2.0:
            return ShotZone.DEEP
        if y < SERVICE_LINE_NEAR:
            return ShotZone.MID
        return ShotZone.SERVICE
    if y > COURT_LENGTH - 2.0:
        return ShotZone.DEEP
    if y > SERVICE_LINE_FAR:
        return ShotZone.MID
    return ShotZone.SERVICE


def clamp_to_court(p: CourtPoint) -> CourtPoint:
    return (
        float(np.clip(p[0], -1.5, COURT_WIDTH + 1.5)),
        float(np.clip(p[1], -2.0, COURT_LENGTH + 2.0)),
    )


def bbox_center(bbox: Bbox) -> tuple[float, float]:
    x1, y1, x2, y2 = bbox
    return ((x1 + x2) / 2, (y1 + y2) / 2)


def bbox_feet(bbox: Bbox) -> tuple[float, float]:
    """Bottom-center of a player bbox: a better proxy for court position."""
    x1, _, x2, y2 = bbox
    return ((x1 + x2) / 2, y2)


def direction_for(
    hit_position: CourtPoint,
    landing_position: CourtPoint | None,
    trajectory_end: CourtPoint | None = None,
) -> ShotDirection:
    """Classify a shot as cross / line / middle.

    Compares the lateral thirds the ball travels between. Falls back to the
    raw trajectory endpoint when no bounce (landing) was detected.
    """
    end = landing_position or trajectory_end
    if end is None:
        return ShotDirection.MIDDLE

    hitter_third = _lateral_third(hit_position[0])
    end_third = _lateral_third(end[0])
    lateral_travel = end[0] - hit_position[0]

    # Ball crossing the center line from an outer third -> cross court.
    crossed_center = (hit_position[0] - CENTER_X) * (end[0] - CENTER_X) < 0
    if crossed_center and hitter_third != 0:
        return ShotDirection.CROSS
    if hitter_third != 0 and end_third == hitter_third and abs(lateral_travel) < COURT_WIDTH * 0.35:
        return ShotDirection.LINE
    if hitter_third == 0 or end_third == 0:
        return ShotDirection.MIDDLE
    return ShotDirection.CROSS if crossed_center else ShotDirection.MIDDLE


def _lateral_third(x: float) -> int:
    """-1 = left third, 0 = middle third, +1 = right third (screen coords)."""
    third = COURT_WIDTH / 3
    if x < third:
        return -1
    if x > 2 * third:
        return 1
    return 0


# ---------------------------------------------------------------------------
# Homography between pixel space and court space
# ---------------------------------------------------------------------------

# Canonical pixel-keypoint index -> court coordinate mapping, following the
# 14-keypoint convention used by common tennis court keypoint models
# (4 doubles corners, 4 singles corners, 2 net-single posts ... etc.).
# If your weights use a different order, remap here before calling
# build_homography.
KEYPOINT_COURT_COORDS: dict[int, CourtPoint] = {
    0: (0.0, 0.0),  # near-left doubles corner
    1: (COURT_WIDTH, 0.0),  # near-right doubles corner
    2: (COURT_WIDTH, COURT_LENGTH),  # far-right doubles corner
    3: (0.0, COURT_LENGTH),  # far-left doubles corner
    4: (SINGLES_MARGIN, 0.0),  # near-left singles corner
    5: (COURT_WIDTH - SINGLES_MARGIN, 0.0),  # near-right singles corner
    6: (COURT_WIDTH - SINGLES_MARGIN, COURT_LENGTH),  # far-right singles
    7: (SINGLES_MARGIN, COURT_LENGTH),  # far-left singles
    8: (CENTER_X, NET_Y - SERVICE_DEPTH),  # center service T, near
    9: (CENTER_X, NET_Y + SERVICE_DEPTH),  # center service T, far
    10: (CENTER_X, NET_Y),  # net center
    11: (SINGLES_MARGIN, SERVICE_LINE_NEAR),  # near service line left
    12: (COURT_WIDTH - SINGLES_MARGIN, SERVICE_LINE_NEAR),  # near svc right
    13: (SINGLES_MARGIN, SERVICE_LINE_FAR),
}


def build_homography(keypoints_px: np.ndarray) -> np.ndarray | None:
    """Fit a pixel->court homography from >=4 keypoint correspondences.

    keypoints_px: flat array [x0, y0, x1, y1, ...] in KEYPOINT_COURT_COORDS order.
    """
    n = len(keypoints_px) // 2
    if n < 4:
        return None
    src, dst = [], []
    for i in range(min(n, len(KEYPOINT_COURT_COORDS))):
        px = keypoints_px[2 * i : 2 * i + 2]
        if np.all(np.isfinite(px)):
            src.append(px)
            dst.append(KEYPOINT_COURT_COORDS[i])
    if len(src) < 4:
        return None
    H, _ = cv2.findHomography(np.array(src, dtype=np.float32), np.array(dst, dtype=np.float32))
    return H


def pixel_to_court(H: np.ndarray, point: tuple[float, float]) -> CourtPoint:
    v = np.array([point[0], point[1], 1.0], dtype=np.float64)
    out = H @ v
    if abs(out[2]) < 1e-9:
        return (float("nan"), float("nan"))
    return clamp_to_court((out[0] / out[2], out[1] / out[2]))


def proxy_court_from_detections(
    frames: list["app.domain.events.FrameDetections"],
) -> np.ndarray | None:
    """Best-effort court mapping without court keypoints.

    Fits an axis-aligned court frame from the distribution of player feet
    and ball pixel positions: players hug the baselines, the ball roams the
    court. Returns a pixel->court homography, or None with too little data.
    """
    px: list[tuple[float, float]] = []
    for f in frames:
        for bbox in f.players.values():
            px.append(bbox_feet(bbox))
        if f.ball is not None:
            px.append(bbox_center(f.ball))
    if len(px) < 12:
        return None
    arr = np.array(px)
    # Robust percentile frame to reject outliers (spectators, officials).
    x_lo, x_hi = np.percentile(arr[:, 0], [5, 95])
    y_lo, y_hi = np.percentile(arr[:, 1], [5, 95])
    if x_hi - x_lo < 10 or y_hi - y_lo < 10:
        return None
    src = np.array(
        [[x_lo, y_lo], [x_hi, y_lo], [x_hi, y_hi], [x_lo, y_hi]], dtype=np.float32
    )
    dst = np.array(
        [[0.0, 0.0], [COURT_WIDTH, 0.0], [COURT_WIDTH, COURT_LENGTH], [0.0, COURT_LENGTH]],
        dtype=np.float32,
    )
    H, _ = cv2.findHomography(src, dst)
    return H


def proxy_map_frame(f: "app.domain.events.FrameDetections", H: np.ndarray) -> None:
    """Fill players_court / ball_court on a frame using a proxy homography."""
    for pid, bbox in f.players.items():
        f.players_court[pid] = pixel_to_court(H, bbox_feet(bbox))
    if f.ball is not None:
        f.ball_court = pixel_to_court(H, bbox_center(f.ball))
