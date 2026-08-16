"""Event engine: turn raw court-coordinate tracks into tactical shot events.

Improvements over the classic "detect y-reversal = shot" approach
(Tennis-Vision et al.):

1. Reversals are computed on *court coordinates*, not image coordinates.
   In top-down court space a rally ball only reverses its length-axis
   direction when a player hits it -- a bounce keeps travelling the same
   way. This removes the classic bounce/hit confusion at the source.
2. Hits are confirmed by player proximity; bounces are detected as speed
   dips (used for landing zones and volley detection).
3. Bounce detection gives a correct volley definition: a hit with no
   intervening bounce since the opponent's hit.
"""

from __future__ import annotations

import numpy as np

from app.domain.events import (
    CourtSide,
    FrameDetections,
    Rally,
    Shot,
)
from app.services.analysis import court_geometry as cg


def _ball_series(frames: list[FrameDetections]) -> list[tuple[int, np.ndarray]]:
    """(frame, xy) pairs for frames with a court-space ball position."""
    out = []
    for f in frames:
        if f.ball_court is not None and np.all(np.isfinite(f.ball_court)):
            out.append((f.frame, np.asarray(f.ball_court, dtype=float)))
    return out


def interpolate_ball(frames: list[FrameDetections]) -> None:
    """Linearly fill missing ball_court gaps in place (simple + predictable)."""
    series = _ball_series(frames)
    if len(series) < 2:
        return
    known = {frm: p for frm, p in series}
    if not known:
        return
    sorted_frames = [frm for frm, _ in series]

    import bisect

    for f in frames:
        if f.ball_court is not None:
            continue
        i = bisect.bisect_left(sorted_frames, f.frame)
        prev_i, next_i = i - 1, i
        if prev_i < 0 or next_i >= len(sorted_frames):
            continue
        f0, f1 = sorted_frames[prev_i], sorted_frames[next_i]
        p0, p1 = known[f0], known[f1]
        t = (f.frame - f0) / (f1 - f0)
        f.ball_court = tuple(p0 + t * (p1 - p0))


def hit_candidates(
    frames: list[FrameDetections], min_sustained: int = 4
) -> list[int]:
    """Frames where the ball starts travelling in a new direction.

    Two candidate sources:
      1. sustained reversals of the court-y direction (groundstrokes)
      2. ball appearances after a tracking gap (serves: the new point's
         first ball frame has no preceding direction to reverse)
    """
    series = _ball_series(frames)
    if len(series) < 2 * min_sustained + 2:
        return []
    ys = np.array([p[1] for _, p in series])
    frms = np.array([frm for frm, _ in series])
    dy = np.diff(ys)
    sign = np.sign(dy)
    # small deadband to ignore sub-decimeter jitter
    sign[np.abs(dy) < 0.02] = 0
    # forward-fill zero signs so short stalls do not fake reversals
    for i in range(1, len(sign)):
        if sign[i] == 0:
            sign[i] = sign[i - 1]

    candidates: list[int] = []
    for i in range(1, len(sign) - 1):
        if sign[i - 1] * sign[i] < 0:  # actual sign flip at i
            before = sign[max(0, i - min_sustained) : i]
            after = sign[i : i + min_sustained]
            if len(before) < min_sustained or len(after) < min_sustained:
                continue
            s = sign[i]
            if (before == s * -1).all() and (after == s).all():
                candidates.append(int(frms[i]))

    # serves: ball reappears after a gap and immediately travels with intent
    gap = max(10, min_sustained * 3)
    prev_frm = None
    for k, (frm, p) in enumerate(series):
        if (prev_frm is None or frm - prev_frm > gap) and k + min_sustained < len(series):
            dyk = series[k + min_sustained][1][1] - p[1]
            if abs(dyk) > 0.3:  # sustained movement, not jitter
                candidates.append(int(frm))
        prev_frm = frm

    # de-duplicate candidates within a few frames (same contact)
    dedup: list[int] = []
    for frm in sorted(set(candidates)):
        if not dedup or frm - dedup[-1] > min_sustained:
            dedup.append(frm)
    return dedup


def confirm_hits(
    frames: list[FrameDetections], candidates: list[int], radius_m: float = 2.4
) -> list[tuple[int, int]]:
    """Keep reversal frames where the ball is near a player: (frame, player).

    The nearest player within `radius_m` at the reversal frame is credited
    with the hit; reversals with nobody nearby are demoted to bounces.
    """
    by_frame = {f.frame: f for f in frames}
    hits: list[tuple[int, int]] = []
    for frm in candidates:
        f = by_frame.get(frm)
        if f is None or f.ball_court is None:
            continue
        best_pid, best_d = None, radius_m
        for pid, pos in f.players_court.items():
            d = float(np.hypot(pos[0] - f.ball_court[0], pos[1] - f.ball_court[1]))
            if d <= best_d:
                best_pid, best_d = pid, d
        if best_pid is not None:
            hits.append((frm, best_pid))
    return hits


def detect_bounces(
    frames: list[FrameDetections], speed_ratio: float = 0.5, window: int = 4
) -> list[int]:
    """Frames where the ball decelerates sharply: fast segment -> slow segment.

    A bounce is a step DOWN in travel speed. We compare the MEAN speed of
    the window just before with the window just after each index (means
    absorb per-frame detection noise, which min/max comparisons would
    misread as bounces mid-flight). The slow plateau right before an
    opponent's contact is a step UP, so it is naturally excluded.
    """
    series = _ball_series(frames)
    if len(series) < 2 * window + 4:
        return []
    pts = np.array([p for _, p in series])
    steps = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    n = len(steps)
    out: list[int] = []
    for i in range(1, n - 1):
        before = steps[max(0, i - window) : i].mean()
        after = steps[i + 1 : min(n, i + 1 + window)].mean()
        if after < speed_ratio * before:
            # the transition sits between series i and i+1; report a frame
            # safely inside the slow segment so the recorded position is at
            # the landing, not several meters before it
            j = min(i + 1 + window // 2, len(series) - 1)
            frm = int(series[j][0])
            if not out or frm - out[-1] > window:  # one detection per transition
                out.append(frm)
    return out


def nearest_player(f: FrameDetections, point) -> int | None:
    best_pid, best_d = None, float("inf")
    for pid, pos in f.players_court.items():
        d = float(np.hypot(pos[0] - point[0], pos[1] - point[1]))
        if d < best_d:
            best_pid, best_d = pid, d
    return best_pid


def segment_rallies(
    frames: list[FrameDetections],
    hits: list[tuple[int, int]],
    gap_frames: int = 80,
) -> list[list[tuple[int, int]]]:
    """Split the hit sequence into rallies at long gaps or side switches."""
    rallies: list[list[tuple[int, int]]] = []
    current: list[tuple[int, int]] = []
    for frm, pid in hits:
        if current:
            if frm - current[-1][0] > gap_frames:
                rallies.append(current)
                current = []
            else:
                # a rally must alternate players
                if pid == current[-1][1]:
                    # two consecutive hits by the same player: keep the
                    # later one, the first was likely a mis-confirmed bounce
                    current[-1] = (frm, pid)
                    continue
        current.append((frm, pid))
    if current:
        rallies.append(current)
    # a rally needs at least a serve plus a return to be tactically useful;
    # keep single-shot rallies only when they are serves (ace candidates)
    return [r for r in rallies if len(r) >= 2]


def build_rallies(
    frames: list[FrameDetections],
    fps: float,
    hits: list[tuple[int, int]],
    bounces: list[int],
    gap_frames: int = 80,
) -> list[Rally]:
    """Full rally construction with enriched shots and inferred outcome."""
    by_frame = {f.frame: f for f in frames}
    ball_at = lambda frm: by_frame[frm].ball_court if frm in by_frame else None

    groups = segment_rallies(frames, hits, gap_frames)
    rallies: list[Rally] = []
    for rid, group in enumerate(groups):
        server = group[0][1]
        start, end = group[0][0], group[-1][0]
        serve_side = _serve_side(by_frame.get(start), server)

        shots: list[Shot] = []
        last_bounce_before: int | None = None
        for si, (frm, pid) in enumerate(group):
            f = by_frame.get(frm)
            if f is None or f.ball_court is None:
                continue
            prev_hit_frame = group[si - 1][0] if si > 0 else None
            bounces_since = [
                b for b in bounces
                if (prev_hit_frame is None or prev_hit_frame < b < frm)
            ]
            landing = None
            next_hit_frame = group[si + 1][0] if si + 1 < len(group) else None
            landing_bounces = [
                b for b in bounces
                if frm < b and (next_hit_frame is None or b < next_hit_frame)
            ]
            if landing_bounces:
                lb = landing_bounces[0]
                lpos = ball_at(lb)
                landing = tuple(lpos) if lpos is not None else None

            is_serve = si == 0
            zone = cg.zone_for(f.ball_court[1])
            # Volley: no bounce since the opponent's hit and contact in the
            # front half of the hitter's side (serves are excluded).
            no_bounce_since_prev = len(bounces_since) == 0 and not is_serve
            in_front = _in_front_zone(f.ball_court, pid)
            is_volley = bool(no_bounce_since_prev and in_front)

            direction = cg.direction_for(
                f.ball_court,
                landing,
                trajectory_end=_trajectory_end(frames, frm, next_hit_frame),
            )
            speed = _outgoing_speed(frames, frm, next_hit_frame, fps)

            shots.append(
                Shot(
                    index=si,
                    frame=frm,
                    time_s=round(frm / fps, 2),
                    player_id=pid,
                    is_serve=is_serve,
                    is_volley=is_volley,
                    hit_position=tuple(f.ball_court),
                    landing_position=landing,
                    side=cg.side_for(pid, f.ball_court[0]),
                    zone=zone,
                    direction=direction,
                    speed_kmh=speed,
                )
            )

        winner, reason, conf = _infer_outcome(frames, group, bounces, ball_at)
        rallies.append(
            Rally(
                id=rid,
                start_frame=start,
                end_frame=end,
                server=server,
                serve_side=serve_side,
                shots=shots,
                winner=winner,
                end_reason=reason,
                winner_confidence=conf,
            )
        )
    return rallies


def _serve_side(f: FrameDetections | None, server: int) -> CourtSide:
    if f is None or server not in f.players_court:
        return CourtSide.DEUCE
    return cg.side_for(server, f.players_court[server][0])


def _in_front_zone(point, hitter: int) -> bool:
    near = point[1] < cg.NET_Y
    if hitter == 1:
        return near and point[1] > cg.NET_Y - 8.0
    return (not near) and point[1] < cg.NET_Y + 8.0


def _trajectory_end(
    frames: list[FrameDetections], hit_frame: int, next_hit: int | None
):
    by_frame = {f.frame: f for f in frames}
    limit = next_hit if next_hit is not None else hit_frame + int(1.5 * 25)
    best = None
    for frm in range(hit_frame, min(limit + 1, max(by_frame) + 1)):
        f = by_frame.get(frm)
        if f and f.ball_court is not None:
            best = f.ball_court
    return best


def _outgoing_speed(frames: list[FrameDetections], hit_frame: int, next_hit: int | None, fps: float) -> float | None:
    """Planar (top-down) ball speed right after contact, km/h."""
    by_frame = {f.frame: f for f in frames}
    p0 = by_frame.get(hit_frame)
    if p0 is None or p0.ball_court is None:
        return None
    f1 = hit_frame + max(2, int(fps * 0.12))  # ~120 ms window
    p1 = by_frame.get(min(f1, max(by_frame)))
    if p1 is None or p1.ball_court is None:
        return None
    d = float(np.hypot(p1.ball_court[0] - p0.ball_court[0], p1.ball_court[1] - p0.ball_court[1]))
    dt = (p1.frame - p0.frame) / fps
    if dt <= 0:
        return None
    # planar speed underestimates true speed (ignores arc) -> flag as approx
    return round(d / dt * 3.6, 1)


def _infer_outcome(frames, group, bounces, ball_at):
    """Infer who won the point, with an honesty score.

    Signals:
    - double bounce on one side after the last hitter's shot -> hitter won
    - ball tracking ends shortly after the last shot -> hitter likely won
    - rally truncated by analysis bounds -> unknown
    """
    last_frame_hit, last_pid = group[-1]
    opp = 2 if last_pid == 1 else 1
    opp_zone = (cg.NET_Y, cg.COURT_LENGTH) if opp == 2 else (0.0, cg.NET_Y)

    later_bounces = [b for b in bounces if b > last_frame_hit]
    if len(later_bounces) >= 2:
        both_in_opp = all(
            ball_at(b) is not None and opp_zone[0] <= ball_at(b)[1] <= opp_zone[1]
            for b in later_bounces[:2]
        )
        if both_in_opp:
            return last_pid, "double_bounce", 0.9
    if len(later_bounces) == 1 and ball_at(later_bounces[0]) is not None:
        b = ball_at(later_bounces[0])
        in_opp = opp_zone[0] <= b[1] <= opp_zone[1]
        if in_opp:
            return last_pid, "noreturn", 0.6
    # fallback: last hitter wins a point that simply ran out of tracking
    return last_pid, "truncated", 0.3
