"""Tour 模块测试：比分解析、指标引擎、Elo、报告组装、API。

纯函数与合成数据库测试为主（不依赖 240MB 真实库）；API 测试在真实库
存在时才运行。
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from app.tour import db as tour_db
from app.tour import metrics, scouting


# ---------------------------------------------------------------------------
# 比分解析
# ---------------------------------------------------------------------------

def test_parse_score_basic():
    r = tour_db.parse_score("7-6(5) 6-4", 3)
    assert (r["sets_w"], r["sets_l"], r["games_w"], r["games_l"], r["tb_w"]) == (2, 0, 13, 10, 1)
    assert r["completed"] == 1 and r["deciding"] == 0


def test_parse_score_deciding_set():
    r = tour_db.parse_score("4-6 6-3 7-5", 3)
    assert (r["completed"], r["deciding"], r["deciding_w"]) == (1, 1, 1)


def test_parse_score_best_of_five():
    r = tour_db.parse_score("6-4 3-6 7-6(4) 4-6 6-4", 5)
    assert (r["sets_w"], r["sets_l"], r["completed"], r["deciding"]) == (3, 2, 1, 1)


def test_parse_score_retirement_and_walkover():
    r = tour_db.parse_score("6-4 3-6 2-1 ret", 3)
    assert (r["completed"], r["ret"]) == (0, 1)
    assert tour_db.parse_score("w/o", 3)["wo"] == 1


def test_parse_score_missing_and_junk():
    assert tour_db.parse_score(None, 3)["no_score"] == 1
    assert tour_db.parse_score("", 3)["no_score"] == 1
    r = tour_db.parse_score("6-4 6-4 (Sep 22)", 3)
    assert r["completed"] == 1  # 未知 token 不致命


# ---------------------------------------------------------------------------
# 合成数据库（指标 / Elo / 报告）
# ---------------------------------------------------------------------------

def _mk_match(mid, tour, w, l, date, score="6-4 6-4", best_of=3, completed=True,
              w_stats=None, l_stats=None, w_rank=None, l_rank=None, surface="Hard",
              level="A", minutes=90):
    w_stats = w_stats or {}
    l_stats = l_stats or {}
    p = tour_db.parse_score(score, best_of)
    if not completed:
        p["completed"] = 0
    defaults = dict(svpt=100, _1stIn=60, _1stWon=45, _2ndWon=25, SvGms=10,
                    bpSaved=3, bpFaced=4, ace=5, df=2)
    ws = {**defaults, **w_stats}
    ls = {**defaults, **l_stats}
    return (
        mid, tour, "main", f"{date}-001", "Synthetic Open", surface, level,
        date, "F", best_of, minutes, w, l, f"Player{w}", f"Player{l}", score,
        p["completed"], p["ret"], p["wo"], p["no_score"],
        p["sets_w"], p["sets_l"], p["games_w"], p["games_l"],
        p["tb_w"], p["tb_l"], p["deciding"], p["deciding_w"],
        ws["svpt"], ws["_1stIn"], ws["_1stWon"], ws["_2ndWon"], ws["SvGms"],
        ws["bpSaved"], ws["bpFaced"], ws["ace"], ws["df"],
        ls["svpt"], ls["_1stIn"], ls["_1stWon"], ls["_2ndWon"], ls["SvGms"],
        ls["bpSaved"], ls["bpFaced"], ls["ace"], ls["df"],
        w_rank, 1000, l_rank, 900,
    )


@pytest.fixture()
def synth_db(tmp_path: Path) -> Path:
    path = tmp_path / "synth.db"
    conn = tour_db.connect(path)
    conn.executescript(tour_db.SCHEMA)
    # 三名球员：1 打 2（两连胜），1 打 3（一负）
    players = [
        (1, "atp", "Alpha Tester", "Alpha", "Tester", "R", "20000101", "USA", 185, None),
        (2, "atp", "Beta Rival", "Beta", "Rival", "L", "19990101", "ESP", 180, None),
        (3, "atp", "Gamma Closer", "Gamma", "Closer", "R", "19950101", "FRA", 190, None),
    ]
    conn.executemany("INSERT INTO players VALUES (?,?,?,?,?,?,?,?,?,?)", players)
    matches = [
        _mk_match("m1", "atp", 1, 2, "20250601", "6-4 6-4",
                  w_stats=dict(svpt=100, _1stIn=60, _1stWon=45, _2ndWon=25, SvGms=10,
                               bpSaved=3, bpFaced=4, ace=5, df=2),
                  l_stats=dict(svpt=90, _1stIn=50, _1stWon=30, _2ndWon=20, SvGms=9,
                               bpSaved=2, bpFaced=5, ace=3, df=4),
                  w_rank=10, l_rank=20),
        _mk_match("m2", "atp", 1, 2, "20250701", "4-6 7-5 6-4",
                  w_stats=dict(svpt=120, _1stIn=70, _1stWon=50, _2ndWon=30, SvGms=13,
                               bpSaved=4, bpFaced=6, ace=8, df=3),
                  l_stats=dict(svpt=110, _1stIn=60, _1stWon=40, _2ndWon=25, SvGms=12,
                               bpSaved=3, bpFaced=7, ace=4, df=5),
                  w_rank=10, l_rank=20),
        _mk_match("m3", "atp", 3, 1, "20250801", "6-3 6-3",
                  w_stats=dict(svpt=80, _1stIn=50, _1stWon=35, _2ndWon=18, SvGms=9,
                               bpSaved=1, bpFaced=1, ace=2, df=1),
                  l_stats=dict(svpt=85, _1stIn=45, _1stWon=28, _2ndWon=20, SvGms=8,
                               bpSaved=1, bpFaced=4, ace=1, df=3),
                  w_rank=50, l_rank=10),
    ]
    cols = ",".join("?" * len(tour_db._MATCH_COLS))
    conn.executemany(f"INSERT INTO matches VALUES ({cols})", matches)
    conn.executemany(
        "INSERT INTO rankings VALUES (?,?,?,?,?)",
        [("atp", "20250801", 1, 10, 3000), ("atp", "20250801", 2, 20, 2000),
         ("atp", "20250801", 3, 50, 1000)],
    )
    # 手工 Elo（build_report 不重放 Elo，读表）
    conn.executemany(
        "INSERT INTO elo VALUES (?,?,?,?,?,?,?,?,?,?)",
        [(1, "atp", 1800.0, 1750.0, 1810.0, 1790.0, 30, 10, 15, 5),
         (2, "atp", 1700.0, 1680.0, 1710.0, 1690.0, 30, 10, 15, 5),
         (3, "atp", 1650.0, 1600.0, 1660.0, 1640.0, 30, 10, 15, 5)],
    )
    conn.execute("INSERT INTO meta VALUES ('data_to', '20250801')")
    conn.execute("INSERT INTO meta VALUES ('synced_at', '2025-08-01T00:00:00')")
    conn.commit()
    conn.close()
    return path


def test_player_matches_orientation_and_metrics(synth_db: Path):
    conn = tour_db.get_conn(synth_db)
    ms = metrics.player_matches(conn, 1, metrics.MatchFilter(tour="atp"))
    assert len(ms) == 3
    # 最新在前，视角正确：m3 中 player1 是败方
    m3 = ms[0]
    assert m3["won"] == 0 and m3["opp_id"] == 3
    assert m3["m_svpt"] == 85 and m3["o_svpt"] == 80
    assert m3["deciding_won"] == 0
    # m2 是决胜盘胜
    m2 = [m for m in ms if m["date"] == "20250701"][0]
    assert m2["deciding_won"] == 1

    prof = metrics.serve_return_profile(ms)
    # 手算：m1+m2 发球端合计 svpt=220, 1stIn=130, 1stWon=95, 2ndWon=55, SvGms=23,
    # bpFaced=10, bpSaved=7；m3 败方 svpt=85, 1stIn=45, 1stWon=28, 2ndWon=20,
    # SvGms=8, bpFaced=4, bpSaved=1
    assert prof["serve"]["service_points"] == 305
    assert prof["serve"]["first_serve_pct"] == pytest.approx(100 * 175 / 305, abs=0.2)
    # 保发率 = (23+8 - (10-7) - (4-1)) / 31
    assert prof["serve"]["hold_pct"] == pytest.approx(100 * (31 - 3 - 3) / 31, abs=0.2)
    # 破发率 = ((5-2)+(7-3)+(1-1)) / (9+12+9)
    assert prof["return"]["break_pct"] == pytest.approx(100 * 7 / 30, abs=0.2)
    # DR = rpw / (1 - spw)
    spw = (95 + 55 + 28 + 20) / 305
    rpw = 1 - (50 + 65 + 35 + 18) / (90 + 110 + 80)
    assert prof["dominance_ratio"] == pytest.approx(rpw / (1 - spw), abs=0.01)

    wl = metrics.win_loss(ms)
    assert (wl["matches"], wl["wins"], wl["losses"]) == (3, 2, 1)
    assert wl["deciding_w"] == 1 and wl["deciding_l"] == 0
    assert wl["vs_top50"]["wins"] == 2

    form = metrics.recent_form(ms)
    assert form["last10"]["wins"] == 2
    # 最近一场输了 → 连败 1
    assert form["last10"]["streak"] == -1
    assert form["last10"]["best_win_rank"] == 20

    fat = metrics.fatigue(ms, today="20250801")
    assert fat["matches_28d"] == 1
    assert fat["rest_days"] == 0


def test_elo_replay_direction(tmp_path: Path):
    # 同一玩家连赢 → Elo 应显著高于对手
    import pandas as pd

    df = pd.DataFrame([
        dict(tourney_date="20250101", tourney_level="A", surface="Hard",
             winner_id=1, loser_id=2, sets_w=2, sets_l=0),
        dict(tourney_date="20250201", tourney_level="A", surface="Hard",
             winner_id=1, loser_id=2, sets_w=2, sets_l=0),
    ])
    rows = tour_db._replay_elo(df, "atp")
    by_pid = {r[0]: r for r in rows}
    assert by_pid[1][2] > by_pid[2][2]
    assert by_pid[1][6] == 2  # elo_n


def test_population_percentiles_too_small(synth_db: Path):
    conn = tour_db.get_conn(synth_db)
    out = metrics.population_percentiles(conn, "atp", {"hold_pct": 80.0})
    assert out == {}  # 人群不足 30 人


def test_build_report_structure(synth_db: Path):
    report = scouting.build_report(
        synth_db, opponent_id=1, tour="atp", surface="Hard", months=12
    )
    assert report["opponent"]["name"] == "Alpha Tester"
    assert report["opponent"]["current_rank"] == 10
    assert report["opponent"]["peak_rank"] == 10
    assert report["opponent"]["elo"]["elo_overall"] == 1800.0
    assert report["surface_stats"]["serve"]["hold_pct"] > 0
    assert report["context"]["surface"] == "Hard"
    assert report["recent_form"]["last10"]["wins"] == 2
    assert len(report["recent_matches"]) == 3
    # H2H
    report_h2h = scouting.build_report(
        synth_db, opponent_id=2, tour="atp", client_id=1, surface=None, months=12
    )
    assert report_h2h["h2h"]["matches"] == 2
    assert report_h2h["h2h"]["wins"] == 2  # 我方(player1)视角

    # 未知球员
    with pytest.raises(KeyError):
        scouting.build_report(synth_db, opponent_id=999, tour="atp")


def test_search_players(synth_db: Path):
    conn = tour_db.get_conn(synth_db)
    hits = scouting.search_players(conn, "alpha")
    assert len(hits) == 1 and hits[0]["player_id"] == 1
    assert scouting.search_players(conn, "zzz") == []
    assert scouting.search_players(conn, "a") == []  # <2 字符


# ---------------------------------------------------------------------------
# API（依赖真实资料库；未建库则跳过）
# ---------------------------------------------------------------------------

REAL_DB = Path(__file__).resolve().parents[1] / "data" / "tour" / tour_db.DB_NAME

pytestmark_api = pytest.mark.skipif(not REAL_DB.exists(), reason="tour db not built")


@pytest.mark.skipif(not REAL_DB.exists(), reason="tour db not built")
def test_tour_api_endpoints():
    from fastapi.testclient import TestClient

    from app.main import create_app

    client = TestClient(create_app())
    r = client.get("/api/tour/status")
    assert r.status_code == 200 and r.json()["built"] is True

    r = client.get("/api/tour/players", params={"q": "alcaraz"})
    assert r.status_code == 200
    names = [p["name"] for p in r.json()]
    assert "Carlos Alcaraz" in names  # 修复跨巡回赛 id 覆盖后必须能搜到

    carlos = next(p for p in r.json() if p["name"] == "Carlos Alcaraz")
    r = client.post(
        "/api/tour/scouting",
        json={"opponent_id": carlos["player_id"], "tour": "atp", "surface": "Clay"},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["opponent"]["name"] == "Carlos Alcaraz"
    assert body["surface_stats"]["serve"]["matches"] > 0
    assert body["percentiles"]["hold_pct"]["percentile"] > 50  # 红土保发应强

    r = client.post("/api/tour/scouting", json={"opponent_id": 999999, "tour": "atp"})
    assert r.status_code == 404
    r = client.post("/api/tour/scouting", json={"opponent_id": 1, "tour": "xxx"})
    assert r.status_code == 400
