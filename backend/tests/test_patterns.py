"""End-to-end tests over the synthetic demo match (no models needed)."""

from app.domain.events import CourtSide, Shot, ShotDirection, ShotZone
from app.services import fixtures
from app.services.analysis import events, patterns


def _run_demo_engine(n_points=24):
    frames, fps = fixtures.generate_demo_match(n_points=n_points)
    events.interpolate_ball(frames)
    cands = events.hit_candidates(frames, min_sustained=4)
    hits = events.confirm_hits(frames, cands, radius_m=2.4)
    bounces = events.detect_bounces(frames)
    rallies = events.build_rallies(frames, fps, hits, bounces, gap_frames=80)
    return frames, rallies


def test_demo_match_recovers_planted_rally_structure():
    _, rallies = _run_demo_engine()
    assert len(rallies) >= 15, f"expected ~24 rallies, got {len(rallies)}"
    for r in rallies:
        assert r.shots, f"rally {r.id} empty"
        assert r.shots[0].is_serve, f"rally {r.id} first shot not marked as serve"
        # players must alternate through the rally
        for a, b in zip(r.shots, r.shots[1:]):
            assert a.player_id != b.player_id
        assert r.winner in (1, 2)


def test_demo_match_planted_patterns_are_mined():
    _, rallies = _run_demo_engine()
    cards = patterns.mine_all(rallies, min_support=3)
    codes = {c.code for c in cards}
    # planted: P1 deuce-side wide serve -> +1 cross
    assert any(c.startswith("serve_1_deuce_wide") for c in codes), codes
    assert any(c.startswith("sp1_1_deuce_wide_cross") for c in codes), codes
    # planted: long rallies belong to P2
    assert any(c.startswith("rallylen_long") and c.endswith("_2") for c in codes), codes


def test_stats_match_rallies():
    _, rallies = _run_demo_engine()
    stats = patterns.compute_stats(rallies)
    assert stats.points == len(rallies)
    assert stats.longest_rally == max(len(r.shots) for r in rallies)
    total_shots = sum(len(r.shots) for r in rallies)
    assert sum(stats.shots.values()) == total_shots


def test_direction_labels_are_coherent():
    """Every rally shot against a baseline player must be cross/line/middle."""
    _, rallies = _run_demo_engine()
    labelled = 0
    for r in rallies:
        for s in r.shots:
            if s.direction is not None:
                assert s.direction in (
                    ShotDirection.CROSS,
                    ShotDirection.LINE,
                    ShotDirection.MIDDLE,
                )
                labelled += 1
    assert labelled > 50


def test_serve_landing_lies_in_target_service_box():
    """Serves in the demo fixture must land inside the diagonally-correct box.

    The event engine is heuristic; a small fraction of first shots can be
    misattributed, so we assert the strong majority (>= 85%), not 100%.
    """
    from app.services.analysis import court_geometry as cg

    _, rallies = _run_demo_engine()
    checked = 0
    bad = 0
    for r in rallies:
        s = r.shots[0]
        if not s.is_serve or s.landing_position is None:
            continue
        x, y = s.landing_position
        if not (cg.SERVICE_LINE_NEAR - 0.6 <= y <= cg.SERVICE_LINE_FAR + 0.6):
            bad += 1
        else:
            if r.serve_side == CourtSide.DEUCE:
                assert cg.SINGLES_MARGIN - 0.5 <= x <= cg.CENTER_X + 0.5, (x, y)
            else:
                assert cg.CENTER_X - 0.5 <= x <= cg.COURT_WIDTH - cg.SINGLES_MARGIN + 0.5, (x, y)
        checked += 1
    assert checked >= 10
    assert bad / checked < 0.15, f"{bad}/{checked} serve landings out of the box"


def test_volley_detection_finds_fixture_volleys():
    """Fixture plants volleys; the engine should find some (not all shots)."""
    _, rallies = _run_demo_engine()
    volleys = [s for r in rallies for s in r.shots if s.is_volley]
    assert 0 < len(volleys) < len(rallies)  # some, but clearly a minority
    for s in volleys:
        assert abs(s.hit_position[1] - 11.885) < 8.0  # contact near the net


def test_shot_zones_populated():
    _, rallies = _run_demo_engine()
    zones = {s.zone for r in rallies for s in r.shots if s.zone is not None}
    # hits come from behind the baseline (deep) and volleys near the net (front)
    assert ShotZone.DEEP in zones
    assert ShotZone.FRONT in zones
