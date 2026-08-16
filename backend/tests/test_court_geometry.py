from app.domain.events import CourtSide, Shot, ShotZone
from app.services.analysis import court_geometry as cg


def test_side_for_near_player():
    # camera behind near player: their right = screen right = deuce
    assert cg.side_for(1, 8.0) == CourtSide.DEUCE
    assert cg.side_for(1, 3.0) == CourtSide.AD


def test_side_for_far_player_mirrored():
    assert cg.side_for(2, 3.0) == CourtSide.DEUCE
    assert cg.side_for(2, 8.0) == CourtSide.AD


def test_zone_for_depth_bands():
    assert cg.zone_for(0.8) == ShotZone.DEEP       # at near baseline
    assert cg.zone_for(4.0) == ShotZone.MID        # no-man's land
    assert cg.zone_for(8.5) == ShotZone.SERVICE    # inside near service box
    assert cg.zone_for(11.885) == ShotZone.FRONT   # at the net
    assert cg.zone_for(22.5) == ShotZone.DEEP      # far baseline


def test_direction_cross_vs_line():
    # near player, right third -> far left third = cross
    assert cg.direction_for((8.5, 1.0), (2.5, 21.0)) == cg.ShotDirection.CROSS
    # near right third -> far right third = line
    assert cg.direction_for((8.5, 1.0), (8.0, 21.0)) == cg.ShotDirection.LINE
    # into the middle third = middle
    assert cg.direction_for((2.0, 1.0), (5.0, 20.0)) == cg.ShotDirection.MIDDLE


def _serve(landing, side):
    return Shot(
        index=0, frame=0, time_s=0.0, player_id=1, is_serve=True,
        hit_position=(8.0, 0.5), landing_position=landing, side=side,
    )


def test_serve_direction_labels_within_target_box():
    from app.services.analysis.patterns import serve_direction

    # deuce box: x 1.37..5.485 -- wide near sideline, T near center line
    assert serve_direction(_serve((1.8, 15.0), CourtSide.DEUCE), CourtSide.DEUCE) == "wide"
    assert serve_direction(_serve((5.2, 15.0), CourtSide.DEUCE), CourtSide.DEUCE) == "t"
    assert serve_direction(_serve((3.4, 15.0), CourtSide.DEUCE), CourtSide.DEUCE) == "body"
    # ad box mirrors: x 5.485..9.6
    assert serve_direction(_serve((9.0, 15.0), CourtSide.AD), CourtSide.AD) == "wide"
    assert serve_direction(_serve((5.8, 15.0), CourtSide.AD), CourtSide.AD) == "t"
    # landing outside the box is not labelled
    assert serve_direction(_serve((8.0, 15.0), CourtSide.DEUCE), CourtSide.DEUCE) is None


def test_homography_maps_corners_to_court_coords():
    import numpy as np

    # synthetic perspective: pixel square -> court rectangle
    src = np.array([50, 400, 590, 400, 590, 40, 50, 40], dtype=np.float32)
    H = cg.build_homography(src)
    assert H is not None
    x, y = cg.pixel_to_court(H, (50, 400))
    assert abs(x) < 0.5 and abs(y) < 0.5
    x, y = cg.pixel_to_court(H, (590, 40))
    assert abs(x - cg.COURT_WIDTH) < 0.5 and abs(y - cg.COURT_LENGTH) < 0.5
