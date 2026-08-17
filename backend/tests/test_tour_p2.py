"""二期测试：微观图表层（MCP）聚合、签表导航、报告集成。"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from app.tour import charting as tour_charting
from app.tour import db as tour_db
from app.tour import scouting


@pytest.fixture()
def mcp_db(tmp_path: Path) -> Path:
    path = tmp_path / "mcp.db"
    conn = tour_db.connect(path)
    conn.executescript(tour_db.SCHEMA)
    conn.executemany(
        "INSERT INTO players VALUES (?,?,?,?,?,?,?,?,?,?)",
        [(1, "atp", "Alpha Tester", "Alpha", "Tester", "R", "20000101", "USA", 185, None),
         (2, "atp", "Beta Rival", "Beta", "Rival", "L", "19990101", "ESP", 180, None)],
    )
    conn.executemany(
        "INSERT INTO rankings VALUES (?,?,?,?,?)",
        [("atp", "20250801", 1, 10, 3000), ("atp", "20250801", 2, 20, 2000)],
    )
    # 一个微型签表赛事：2026 测试公开赛，R32 起 3 轮 + 决赛
    # P1 一路夺冠：胜 P2(R32)、P3(R16)、P4(QF)；P5 胜 P6 后止步 SF? 简化：
    # R32: P1>P2, P3>P4 ; R16: P1>P3 ; F: P1>(另一侧胜者 P5)
    # P5: R32 胜 P6, R16 胜 P7, F 负 P1 → P5 输过，被淘汰
    players = {1: "Alpha Tester", 2: "Beta Rival", 3: "Gamma C", 4: "Delta D",
               5: "Epsilon E", 6: "Zeta Z", 7: "Eta H"}
    for pid, name in players.items():
        conn.execute("INSERT OR REPLACE INTO players VALUES (?,?,?,?,?,?,?,?,?,?)",
                     (pid, "atp", name, name.split()[0], name.split()[-1], "R",
                      "20000101", "USA", 180, None))
    matches = [
        ("t1", "R32", 1, 2, "6-4 6-4"),
        ("t2", "R32", 3, 4, "6-3 6-3"),
        ("t3", "R32", 5, 6, "7-5 6-4"),
        ("t4", "R32", 7, 2, "w/o"),          # 伪造：7 轮空晋级（不应按胜场计）
        ("t5", "R16", 1, 3, "6-2 6-2"),
        ("t6", "R16", 5, 7, "6-4 3-6 6-4"),
        ("t7", "F", 1, 5, "6-4 6-4"),
    ]
    for mid, rd, w, l, score in matches:
        p = tour_db.parse_score(score, 3)
        conn.execute(
            "INSERT INTO matches (match_id, tour, tier, tourney_id, tourney_name, surface, "
            "tourney_level, tourney_date, round, winner_id, loser_id, winner_name, loser_name, "
            "score, completed, wo, sets_w, sets_l, deciding, deciding_w) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (mid, "atp", "main", "2026-999", "Test Open", "Hard", "A", "20260701",
             rd, w, l, players[w], players[l], score, p["completed"], p["wo"],
             p["sets_w"], p["sets_l"], p["deciding"], p["deciding_w"]),
        )
    conn.execute("INSERT INTO meta VALUES ('data_to', '20260701')")
    conn.commit()
    conn.close()
    return path


def test_tournament_draw_and_path(mcp_db: Path):
    conn = tour_db.get_conn(mcp_db)
    draw = scouting.tournament_draw(conn, "2026-999", "atp")
    assert draw["completed"] is True
    assert draw["alive"][0]["player_id"] == 1  # 冠军
    assert set(draw["rounds"]) == {"R32", "R16", "F"}

    mine = scouting.my_draw_path(conn, "2026-999", "atp", 1)
    assert mine["status"] == "completed"
    assert [m["round"] for m in mine["my_matches"]] == ["R32", "R16", "F"]

    with pytest.raises(KeyError):
        scouting.tournament_draw(conn, "nope", "atp")


def test_charting_profile_synthetic(mcp_db: Path):
    conn = tour_db.get_conn(mcp_db)
    conn.executescript("""
    CREATE TABLE mcp_matches (match_id TEXT, p1 TEXT, p2 TEXT, Date TEXT,
                              Surface TEXT, tour TEXT);
    CREATE TABLE mcp_map (mcp_name TEXT, tour TEXT, player_id INTEGER);
    CREATE TABLE mcp_serve_direction (match_id TEXT, player TEXT, "row" TEXT,
        deuce_wide INTEGER, deuce_middle INTEGER, deuce_t INTEGER,
        ad_wide INTEGER, ad_middle INTEGER, ad_t INTEGER);
    CREATE TABLE mcp_rally (match_id TEXT, server TEXT, returner TEXT, "row" TEXT,
        pts INTEGER, pl1_won INTEGER, pl1_winners INTEGER, pl1_forced INTEGER,
        pl1_unforced INTEGER, pl2_won INTEGER, pl2_winners INTEGER,
        pl2_forced INTEGER, pl2_unforced INTEGER);
    """)
    # 3 场图表化比赛（p1 恒为 Alpha，样本门槛）
    for i in range(3):
        mid = f"2026-m{i}"
        conn.execute("INSERT INTO mcp_matches VALUES (?,?,?,?,?,?)",
                     (mid, "Alpha Tester", "Beta Rival", f"20260{6 - i}01", "Hard", "atp"))
        conn.execute(
            'INSERT INTO mcp_serve_direction VALUES (?,?,?,?,?,?,?,?,?)',
            (mid, "Alpha Tester", "2", 10, 0, 0, 20, 0, 0))
    conn.execute("INSERT INTO mcp_map VALUES (?,?,?)", ("Alpha Tester", "atp", 1))
    conn.commit()

    prof = tour_charting.player_profile(conn, 1, "atp", surface="Hard", months=12)
    assert prof and not prof.get("insufficient")
    assert prof["sample_matches"] == 3
    # 二发落点：平分区 100% 外角、占先区 100% 外角
    assert prof["serve_direction"]["second"]["deuce"]["wide_pct"] == 100.0
    assert prof["serve_direction"]["second"]["ad"]["wide_pct"] == 100.0

    # 未知球员（无映射）→ None
    assert tour_charting.player_profile(conn, 999, "atp") is None


def test_charting_tactics_rules():
    chart = {
        "sample_matches": 10,
        "serve_direction": {"second": {"ad": {"wide_pct": 70, "body_pct": 10, "t_pct": 20,
                                              "serves": 100}}},
        "rally": {"0_3": {"pts": 100, "win_pct": 60, "winners": 0, "forced_err": 0,
                          "unforced": 0},
                  "10p": {"pts": 50, "win_pct": 40, "winners": 0, "forced_err": 0,
                          "unforced": 0}},
    }
    tactics = scouting.charting_tactics(chart)
    titles = [t["title"] for t in tactics]
    assert any("占先区" in t and "外角" in t for t in titles)
    assert any("前三拍" in t for t in titles)
    # 样本 <5 场不触发
    assert scouting.charting_tactics({**chart, "sample_matches": 4}) == []


REAL_DB = Path(__file__).resolve().parents[1] / "data" / "tour" / tour_db.DB_NAME


@pytest.mark.skipif(not REAL_DB.exists(), reason="tour db not built")
def test_draw_and_charting_api():
    from fastapi.testclient import TestClient

    from app.main import create_app

    client = TestClient(create_app())
    # 2026 澳网（已完赛）
    r = client.get("/api/tour/draw", params={"tournament_id": "2026-580", "tour": "atp",
                                             "player_id": 206173})
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "completed"
    assert body["my_matches"], "Sinner should have matches in AO2026"

    r = client.get("/api/tour/draw", params={"tournament_id": "nope", "tour": "atp"})
    assert r.status_code == 404

    # Alcaraz 报告必须带图表化微观层（他是被重度图表化的球员）
    r = client.post("/api/tour/scouting", json={"opponent_id": 207989, "tour": "atp",
                                                "surface": "Clay"})
    assert r.status_code == 200
    chart = r.json().get("charting")
    assert chart and chart.get("sample_matches", 0) >= 5
    assert "serve_direction" in chart
    # 图表化战术应出现（或宏观战术存在且总数合理）
    assert r.json()["tactics"]
