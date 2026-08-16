"""Deterministic synthetic match generator (demo mode).

Generates frame-level court-coordinate detections of a plausible singles
match with two *planted* tactical patterns, so the entire pipeline
(events -> rallies -> patterns -> report -> chat) can be exercised without
model weights or a GPU:

    1. Player 1's favourite combo: WIDE serve on the deuce side followed by
       a cross-court putaway -- wins the point far above baseline.
    2. Player 2 owns long rallies (9+ shots).

Trajectory physics are simplified but consistent with the event engine:
ball y reverses direction only at player contacts, bounces are speed dips.
"""

from __future__ import annotations

import numpy as np

from app.domain.events import CourtSide, FrameDetections
from app.services.analysis import court_geometry as cg

FPS = 25.0
IDLE_FRAMES = 90  # between points
NOISE = 0.06  # meters of positional noise on players
BALL_NOISE = 0.02  # ball positions get less noise: speed-dip detection needs it

# Speed ranges are separated wide enough that the bounce detector's
# fast->slow step-down stays unambiguous under per-frame noise.
HIT_SPEED_RANGE = (22.0, 30.0)  # m/s, planar
BOUNCE_SPEED_RANGE = (6.5, 9.5)


def _serve_stand_x(server: int, side: CourtSide) -> float:
    """Server standing x: deuce = their right of the center mark."""
    right_x = 7.9 if server == 1 else 3.1
    left_x = 3.1 if server == 1 else 7.9
    return right_x if side == CourtSide.DEUCE else left_x


def _serve_landing_x(side: CourtSide, serve_dir: str) -> float:
    """Landing x inside the target service box, by serve direction.

    Deuce box (x 1.37..5.485): T at the center line, wide at the sideline.
    Ad box mirrors.
    """
    if side == CourtSide.DEUCE:
        lo, hi = cg.SINGLES_MARGIN, cg.CENTER_X
        frac = {"wide": 0.15, "body": 0.5, "t": 0.88}[serve_dir]
        return lo + frac * (hi - lo)
    lo, hi = cg.CENTER_X, cg.COURT_WIDTH - cg.SINGLES_MARGIN
    frac = {"wide": 0.15, "body": 0.5, "t": 0.88}[serve_dir]  # frac from T edge
    return hi - frac * (hi - lo)


def _receiver_stand_x(side: CourtSide) -> float:
    box_lo, box_hi = (
        (cg.SINGLES_MARGIN, cg.CENTER_X) if side == CourtSide.DEUCE else (cg.CENTER_X, cg.COURT_WIDTH - cg.SINGLES_MARGIN)
    )
    return (box_lo + box_hi) / 2 + 0.6


class DemoMatchBuilder:
    def __init__(self, seed: int = 7):
        self.rng = np.random.RandomState(seed)
        self.frames: list[FrameDetections] = []
        self.frame_no = 0
        # Current player positions (court coords).
        self.p1 = (5.4, 0.9)
        self.p2 = (5.4, 22.9)

    # ------------------------------------------------------------------
    def _emit(self, players: dict[int, tuple[float, float]], ball: tuple[float, float] | None) -> None:
        p1 = tuple(np.asarray(players[1]) + self.rng.uniform(-NOISE, NOISE, 2)) if players.get(1) else self.p1
        p2 = tuple(np.asarray(players[2]) + self.rng.uniform(-NOISE, NOISE, 2)) if players.get(2) else self.p2
        if players.get(1):
            self.p1 = players[1]
        if players.get(2):
            self.p2 = players[2]
        ball_c = None
        if ball is not None:
            ball_c = tuple(np.asarray(ball) + self.rng.uniform(-BALL_NOISE, BALL_NOISE, 2))
        self.frames.append(
            FrameDetections(
                frame=self.frame_no,
                players_court={1: (float(p1[0]), float(p1[1])), 2: (float(p2[0]), float(p2[1]))},
                ball_court=(float(ball_c[0]), float(ball_c[1])) if ball_c else None,
            )
        )
        self.frame_no += 1

    def _fly(self, a, b, speed: float, players: dict[int, tuple[float, float]]) -> None:
        """Emit frames moving the ball a->b at `speed` m/s."""
        a = np.asarray(a, dtype=float)
        b = np.asarray(b, dtype=float)
        dist = float(np.linalg.norm(b - a))
        n = max(2, int(dist / speed * FPS))
        for i in range(1, n + 1):
            pos = a + (b - a) * (i / n)
            self._emit(players, tuple(pos))

    # ------------------------------------------------------------------
    def add_point(
        self,
        server: int,
        side: CourtSide,
        serve_dir: str,
        rally_dirs: list[str],
        winner: int,
        volley_at: int | None = None,
    ) -> None:
        """Emit one point: serve + groundstrokes + ending.

        rally_dirs: direction of each shot AFTER the serve; the first entry
        is the receiver's return, then alternating. If `winner` equals the
        player who played the last scripted shot, the ball dies with a
        double bounce; otherwise the receiver plays one extra unscripted
        ball to win the point. `volley_at` (1-based shot index after the
        serve, < len(rally_dirs)) makes that shot a volley.
        """
        receiver = 2 if server == 1 else 1
        server_y = 0.6 if server == 1 else 23.2

        # Idle frames: both players recover toward neutral.
        for _ in range(IDLE_FRAMES):
            self._emit({}, None)

        contact = (_serve_stand_x(server, side), server_y)
        landing = (
            _serve_landing_x(side, serve_dir),
            self.rng.uniform(13.2, 17.0) if server == 1 else self.rng.uniform(6.8, 10.6),
        )
        rx = _receiver_stand_x(side)
        recv_contact = (rx, 22.6) if receiver == 2 else (rx, 1.2)

        # serve: contact -> bounce in the service box -> receiver contact
        self._fly(contact, landing, self.rng.uniform(*HIT_SPEED_RANGE), {server: contact, receiver: recv_contact})
        incoming = self._next_contact(receiver, landing)
        self._fly(landing, incoming, self.rng.uniform(*BOUNCE_SPEED_RANGE), {receiver: incoming})

        last_hitter, last_contact, last_landing = server, contact, landing
        hitter = receiver
        for k, d in enumerate(rally_dirs):
            out_landing = self._target_landing(hitter, d)
            other = 2 if hitter == 1 else 1
            other_contact = self._next_contact(other, out_landing, front=(volley_at == k + 1))
            is_last = k == len(rally_dirs) - 1
            if volley_at == k + 1:
                # opponent intercepts before the bounce (their reply is the volley)
                self._fly(incoming, other_contact, self.rng.uniform(*HIT_SPEED_RANGE), {other: other_contact})
                last_landing = None
            else:
                self._fly(incoming, out_landing, self.rng.uniform(*HIT_SPEED_RANGE), {hitter: incoming})
                if not (is_last and winner == hitter):
                    self._fly(out_landing, other_contact, self.rng.uniform(*BOUNCE_SPEED_RANGE), {other: other_contact})
                last_landing = out_landing
            last_hitter, last_contact = hitter, incoming
            hitter, incoming = other, other_contact

        if winner == last_hitter:
            # receiver never got the last ball back: it dies with a second bounce
            self._double_bounce_stop(last_landing)
        else:
            # receiver of the last scripted shot plays one more ball to win
            loser_zone = (19.0, 22.5) if last_hitter == 1 else (1.3, 4.8)
            final_landing = (self.rng.uniform(2.0, 9.0), self.rng.uniform(*loser_zone))
            self._fly(incoming, final_landing, self.rng.uniform(*HIT_SPEED_RANGE), {winner: incoming})
            self._double_bounce_stop(final_landing)

    def _double_bounce_stop(self, landing) -> None:
        """Second bounce + stop, drifting toward the nearest baseline.

        Hops are long enough (4+ frames each) for the bounce detector to
        resolve them as two distinct transitions.
        """
        y_dir = 1 if landing[1] > cg.NET_Y else -1
        stop1 = (landing[0] + self.rng.uniform(-0.6, 0.6), landing[1] + y_dir * self.rng.uniform(1.2, 2.2))
        self._fly(landing, stop1, self.rng.uniform(7.0, 9.0), {})
        stop2 = (stop1[0] + self.rng.uniform(-0.3, 0.3), stop1[1] + y_dir * self.rng.uniform(0.6, 1.0))
        self._fly(stop1, stop2, 1.5, {})

    def _next_contact(self, player: int, landing, front: bool = False) -> tuple[float, float]:
        """Where `player` will meet the ball arriving at `landing`."""
        x = float(np.clip(landing[0] + self.rng.uniform(-0.5, 0.5), 1.6, 9.4))
        if front:  # volley position, tight to the net
            y = cg.NET_Y + (2.2 if player == 2 else -2.2) + self.rng.uniform(-0.5, 0.2)
        else:
            y = (0.9 if player == 1 else 22.8) + self.rng.uniform(-0.3, 0.6)
        return (x, y)

    def _target_landing(self, hitter: int, direction: str) -> tuple[float, float]:
        contact_x = self.p1[0] if hitter == 1 else self.p2[0]
        if direction == "cross":
            x = cg.COURT_WIDTH - contact_x + self.rng.uniform(-0.6, 0.6)
        elif direction == "line":
            x = contact_x + self.rng.uniform(-0.6, 0.6)
        else:
            x = cg.CENTER_X + self.rng.uniform(-1.0, 1.0)
        x = float(np.clip(x, 1.7, 9.3))
        # mostly deep; occasionally a short ball
        if self.rng.uniform() < 0.12:
            y = self.rng.uniform(8.5, 10.5) if hitter == 1 else self.rng.uniform(13.3, 15.3)
        else:
            y = self.rng.uniform(19.5, 22.5) if hitter == 1 else self.rng.uniform(1.3, 4.3)
        return (x, y)


def _build_script(rng: np.random.RandomState, n_points: int):
    """Point script with planted patterns (see module docstring)."""
    points = []
    for i in range(n_points):
        server = 1 if (i // 4) % 2 == 0 else 2
        point_no_in_game = i % 4
        side = CourtSide.DEUCE if point_no_in_game % 2 == 0 else CourtSide.AD
        planted = server == 1 and side == CourtSide.DEUCE and rng.uniform() < 0.85
        long_rally = rng.uniform() < 0.28

        if planted:
            serve_dir = "wide"
            # receiver returns, server crosses away for the putaway
            rally_dirs = ["line", "cross"]
            winner = 1 if rng.uniform() < 0.8 else 2
        elif long_rally:
            serve_dir = rng.choice(["t", "body", "wide"])
            n = rng.randint(8, 12)
            rally_dirs = [str(rng.choice(["cross", "line", "middle"])) for _ in range(n)]
            winner = 2 if rng.uniform() < 0.78 else 1
        else:
            serve_dir = str(rng.choice(["t", "body", "wide"]))
            n = rng.randint(1, 6)
            rally_dirs = [str(rng.choice(["cross", "line", "middle"])) for _ in range(n)]
            winner = 1 if rng.uniform() < 0.5 else 2
        points.append((server, side, serve_dir, rally_dirs, winner))
    return points


def generate_demo_match(seed: int = 7, n_points: int = 24) -> tuple[list[FrameDetections], float]:
    rng = np.random.RandomState(seed)
    builder = DemoMatchBuilder(seed)
    for server, side, serve_dir, rally_dirs, winner in _build_script(rng, n_points):
        volley_at = None
        if len(rally_dirs) >= 2 and rng.uniform() < 0.35:
            volley_at = int(rng.randint(1, len(rally_dirs)))  # not the last shot
        builder.add_point(server, side, serve_dir, rally_dirs, winner, volley_at=volley_at)
    return builder.frames, FPS
