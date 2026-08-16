"""Event engine tests on hand-built synthetic trajectories."""

import numpy as np

from app.domain.events import FrameDetections
from app.services.analysis import events

FPS = 25.0


def _fly(start_f, a, b, speed, players):
    a, b = np.asarray(a, float), np.asarray(b, float)
    n = max(2, int(np.linalg.norm(b - a) / speed * FPS))
    out = []
    for i in range(1, n + 1):
        pos = tuple(a + (b - a) * (i / n))
        out.append(FrameDetections(frame=start_f + i, players_court=dict(players), ball_court=pos))
    return start_f + n, out


def _two_shot_rally(hit_speed=24.0, bounce_speed=8.0, with_incoming=True):
    players = {1: (5.4, 1.0), 2: (5.4, 22.8)}
    frames = []
    f = 0
    if with_incoming:
        # ball already travelling toward P1 (bounce phase of P2's previous shot)
        f, frs = _fly(f, (5.0, 21.0), (5.4, 1.0), bounce_speed, players)
        frames += frs
    f, frs = _fly(f, (5.4, 1.0), (6.0, 20.0), hit_speed, players)   # P1 hit
    frames += frs
    f, frs = _fly(f, (6.0, 20.0), (6.3, 22.5), bounce_speed, players)  # bounce
    frames += frs
    f, frs = _fly(f, (6.3, 22.5), (4.5, 3.0), hit_speed, players)   # P2 hit (reversal)
    frames += frs
    f, frs = _fly(f, (4.5, 3.0), (4.2, 1.2), bounce_speed, players)  # bounce
    frames += frs
    return frames


def test_reversal_detected_as_hit_speed_dip_as_bounce():
    frames = _two_shot_rally()
    cands = events.hit_candidates(frames, min_sustained=4)
    # series-start appearance (P2's incoming shot) + two mid-series y
    # reversals: P1's contact and P2's contact
    assert len(cands) == 3, cands
    hits = events.confirm_hits(frames, cands, radius_m=2.4)
    assert {pid for _, pid in hits} == {1, 2}  # each credited to the nearby player

    bounces = events.detect_bounces(frames)
    assert len(bounces) >= 2  # one after each hit


def test_reversal_without_player_is_not_a_hit():
    """A y-reversal far from both players must NOT be confirmed as a hit."""
    frames = _two_shot_rally()
    for f in frames:
        f.players_court = {1: (1.5, 1.0), 2: (9.0, 22.8)}
    cands = events.hit_candidates(frames, min_sustained=4)
    hits = events.confirm_hits(frames, cands, radius_m=2.4)
    assert hits == []


def test_interpolate_ball_fills_gaps():
    frames = []
    for i in range(10):
        ball = (5.0 + i, 10.0) if i % 3 == 0 else None
        frames.append(FrameDetections(frame=i, players_court={1: (5, 1), 2: (5, 22)}, ball_court=ball))
    events.interpolate_ball(frames)
    assert all(f.ball_court is not None for f in frames)
    assert frames[1].ball_court[0] > frames[0].ball_court[0]
    assert frames[2].ball_court[0] < frames[3].ball_court[0]


def test_segment_rallies_gap_and_alternation():
    hits = [(10, 1), (40, 2), (75, 1), (300, 2), (330, 1)]  # long gap before 300
    groups = events.segment_rallies([], hits, gap_frames=80)
    assert [len(g) for g in groups] == [3, 2]
    # consecutive same-player hits collapse to the later one
    groups2 = events.segment_rallies([], [(10, 1), (40, 1), (80, 2)], gap_frames=80)
    assert groups2[0] == [(40, 1), (80, 2)]


def test_build_rallies_marks_serve_and_volleys():
    from app.services.analysis.events import build_rallies

    frames = _two_shot_rally()
    hits = events.confirm_hits(frames, events.hit_candidates(frames, min_sustained=4), 2.4)
    bounces = events.detect_bounces(frames)
    rallies = build_rallies(frames, FPS, hits, bounces, gap_frames=80)
    assert len(rallies) == 1
    r = rallies[0]
    # the series starts with P2's incoming shot, so P2 "serves" this rally
    assert r.server == 2
    assert len(r.shots) == 3
    assert all(not s.is_volley for s in r.shots)  # groundstrokes after bounces
