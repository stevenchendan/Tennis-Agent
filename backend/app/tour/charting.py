"""击球图表化层（Match Charting Project）：落点/方向/回合/网前/关键分。

与 match-level 宏观层（metrics.py）互补，这里全部来自逐分图表化数据——
商业球探报告的微观层数据源。样本是众包图表化的比赛（偏重大赛事与知名
球员），所以每个板块都带 sample_matches（图表化场次）标注；样本不足
（<3 场）时返回 insufficient，调用方降级隐藏该板块。

男女巡回赛的统计表合并入同一张表（match_id 隐含巡回赛归属，如
20260521-M-... / 20260521-W-...）。
"""

from __future__ import annotations

import re
import sqlite3
import unicodedata
from pathlib import Path

import pandas as pd

from app.tour import ingest

# MCP 名字 → 我们库名的已知修正（规范化后仍不一致时手工补）
NAME_OVERRIDES: dict[tuple[str, str], str] = {}

_RENAME = {
    "Player 1": "p1", "Player 2": "p2",
    "Pl 1 hand": "p1_hand", "Pl 2 hand": "p2_hand",
    "Final TB?": "final_tb", "Best of": "best_of",
    "Charted by": "charted_by",
}
_TEXT_COLS = {"match_id", "p1", "p2", "p1_hand", "p2_hand", "Date", "Tournament",
              "Round", "Time", "Court", "Surface", "Umpire", "charted_by",
              "player", "server", "returner", "row", "set"}


def _sanitize(col: str) -> str:
    col = _RENAME.get(col, col)
    return "".join(c if c.isalnum() or c == "_" else "_" for c in col.strip().replace(" ", "_"))


def _norm(name: str) -> str:
    """人名规范化：小写、去变音符/句点、折叠空白。"""
    if not name:
        return ""
    n = unicodedata.normalize("NFKD", name)
    n = "".join(c for c in n if not unicodedata.combining(c))
    return " ".join(n.lower().replace(".", "").replace("-", " ").split())


def _load_table(conn: sqlite3.Connection, table: str, df: pd.DataFrame) -> None:
    df = df.copy()
    df.columns = [_sanitize(c) for c in df.columns]
    for c in df.columns:
        if c not in _TEXT_COLS and c != "tour":
            df[c] = pd.to_numeric(df[c], errors="coerce").astype("Int64")
    cols_sql = ", ".join(f'"{c}"' for c in df.columns)
    conn.execute(f'DROP TABLE IF EXISTS "{table}"')
    conn.execute(f'CREATE TABLE "{table}" ({cols_sql})')
    ph = ",".join("?" * len(df.columns))
    insert_sql = f'INSERT INTO "{table}" ({cols_sql}) VALUES ({ph})'
    rows = []
    for r in df.itertuples(index=False, name=None):
        # numpy Int64 必须转 Python int——否则 sqlite3 存成 BLOB，聚合全废
        rows.append(tuple(
            None if (not isinstance(v, str) and pd.isna(v))
            else (v if isinstance(v, str) else int(v))
            for v in r
        ))
    conn.executemany(insert_sql, rows)


def build_charting(conn: sqlite3.Connection, raw_dir: Path) -> dict:
    """（重新）建 MCP 表：通用入库 + 球员名映射。"""
    total_rows = 0

    # 比赛表：男女合并，附 tour 列
    frames = []
    for code, tour in (("m", "atp"), ("w", "wta")):
        p = raw_dir / f"mcp__charting-{code}-matches.csv"
        if not p.exists():
            continue
        df = pd.read_csv(p, dtype=str, keep_default_na=False, na_values=[""])
        df["tour"] = tour
        frames.append(df)
    if frames:
        merged = pd.concat(frames, ignore_index=True)
        # 同一场比赛可能被两人各图表化一次（重复 match_id），保留一条，
        # 否则统计表按 match_id JOIN 会翻倍。
        merged = merged.drop_duplicates(subset=["match_id"], keep="first")
        _load_table(conn, "mcp_matches", merged)
        total_rows += len(merged)
        conn.execute('CREATE INDEX IF NOT EXISTS idx_mcp_matches_date ON mcp_matches("Date")')

    # 统计表：同名 stat 男女合并（表名 CamelCase → snake_case）
    for stat in ingest.MCP_STATS:
        frames = []
        for code in ("m", "w"):
            p = raw_dir / f"mcp__charting-{code}-stats-{stat}.csv"
            if p.exists():
                frames.append(pd.read_csv(p, dtype=str, keep_default_na=False, na_values=[""]))
        if not frames:
            continue
        table = "mcp_" + re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", stat).lower()
        merged = pd.concat(frames, ignore_index=True)
        _load_table(conn, table, merged)
        total_rows += len(merged)

    _build_map(conn)
    conn.commit()
    return {"rows": total_rows, "stats_tables": len(ingest.MCP_STATS)}


def _build_map(conn: sqlite3.Connection) -> None:
    """MCP 球员名 → (player_id, tour)。规范化匹配 + 手工修正。"""
    ours: dict[tuple[str, str], int] = {}
    for r in conn.execute("SELECT player_id, tour, name FROM players"):
        ours[(_norm(r["name"]), r["tour"])] = r["player_id"]

    conn.execute("DROP TABLE IF EXISTS mcp_map")
    conn.execute("""CREATE TABLE mcp_map (
        mcp_name TEXT, tour TEXT, player_id INTEGER,
        PRIMARY KEY (mcp_name, tour))""")
    names: set[tuple[str, str]] = set()
    for r in conn.execute('SELECT p1, p2, tour FROM mcp_matches'):
        for n in (r["p1"], r["p2"]):
            if n:
                names.add((n, r["tour"]))
    mapped, missed = 0, []
    for name, tour in sorted(names):
        target = NAME_OVERRIDES.get((_norm(name), tour), _norm(name))
        pid = ours.get((target, tour))
        if pid is None:
            missed.append(f"{name}({tour})")
            continue
        conn.execute("INSERT OR REPLACE INTO mcp_map VALUES (?,?,?)", (name, tour, pid))
        mapped += 1

    conn.execute("DROP TABLE IF EXISTS mcp_map_stats")
    conn.execute("CREATE TABLE mcp_map_stats (key TEXT PRIMARY KEY, value TEXT)")
    conn.executemany(
        "INSERT OR REPLACE INTO mcp_map_stats VALUES (?,?)",
        [
            ("mcp_players", str(len(names))),
            ("mapped", str(mapped)),
            ("unmapped", str(len(missed))),
            ("missed_sample", ", ".join(missed[:30])),
        ],
    )


def map_stats(conn: sqlite3.Connection) -> dict:
    try:
        return {r["key"]: r["value"] for r in conn.execute("SELECT * FROM mcp_map_stats")}
    except sqlite3.OperationalError:
        return {}


# ---------------------------------------------------------------------------
# 查询侧：单球员微观层画像
# ---------------------------------------------------------------------------

def _pct(a, b) -> float | None:
    return round(100 * (a or 0) / b, 1) if b else None


def _q(conn: sqlite3.Connection, sql: str, args: list, one: bool = False):
    """容错查询：上游缺表/改列名时该板块静默缺失，不阻塞报告。"""
    try:
        cur = conn.execute(sql, args)
        return cur.fetchone() if one else cur.fetchall()
    except sqlite3.OperationalError:
        return None if one else []


def player_profile(
    conn: sqlite3.Connection, player_id: int, tour: str,
    surface: str | None = None, months: int = 36,
) -> dict | None:
    """对手微观层画像。无图表化数据 → None；<3 场 → insufficient 标记。"""
    row = conn.execute(
        "SELECT mcp_name FROM mcp_map WHERE player_id=? AND tour=?", (player_id, tour)
    ).fetchone()
    if not row:
        return None
    name = row["mcp_name"]

    since_row = conn.execute("SELECT value FROM meta WHERE key='data_to'").fetchone()
    from app.tour.scouting import _months_before

    since = _months_before(since_row["value"] if since_row else "20260101", months)

    def mids(surf: str | None) -> list[str]:
        sql = 'SELECT match_id FROM mcp_matches WHERE tour=? AND (p1=? OR p2=?) AND "Date">=?'
        args: list = [tour, name, name, since]
        if surf:
            sql += " AND Surface=?"
            args.append(surf)
        return [r["match_id"] for r in conn.execute(sql, args)]

    ids = mids(surface)
    note = None
    if len(ids) < 3 and surface:
        ids = mids(None)
        note = "该场地图表化场次不足（<3 场），已放宽为全部场地"
    if len(ids) < 3:
        return {"sample_matches": len(ids), "insufficient": True}

    out: dict = {"sample_matches": len(ids), "note": note}
    ph = ",".join("?" * len(ids))
    base = [name] + ids

    # --- 发球落点（平分区/占先区 × 一二发 × 外/中/T） ---
    rows = _q(conn, f"""SELECT "row", SUM(deuce_wide) dw, SUM(deuce_middle) dm, SUM(deuce_t) dt,
               SUM(ad_wide) aw, SUM(ad_middle) am, SUM(ad_t) at
            FROM mcp_serve_direction
            WHERE player=? AND match_id IN ({ph}) AND "row" IN ('1','2')
            GROUP BY "row\"""", base)
    serve_dir: dict[str, dict] = {}
    for r in rows:
        court: dict[str, dict] = {}
        for side, w, m, t in (("deuce", r["dw"], r["dm"], r["dt"]),
                              ("ad", r["aw"], r["am"], r["at"])):
            tot = (w or 0) + (m or 0) + (t or 0)
            court[side] = {
                "wide_pct": _pct(w, tot), "body_pct": _pct(m, tot), "t_pct": _pct(t, tot),
                "serves": tot,
            }
        serve_dir["first" if r["row"] == "1" else "second"] = court
    if serve_dir:
        out["serve_direction"] = serve_dir

    # --- 前三拍解决倾向（发球分 ≤3 拍赢下的占比） ---
    r = _q(conn, f"""SELECT SUM(pts) pts, SUM(pts_won) w, SUM(pts_won_lte_3_shots) w3,
               SUM(wide) wide, SUM(body) body, SUM(t) t
            FROM mcp_serve_basics WHERE player=? AND match_id IN ({ph})""", base, one=True)
    if r and r["pts"]:
        tot_dir = (r["wide"] or 0) + (r["body"] or 0) + (r["t"] or 0)
        out["first_strike"] = {
            "pts_won_pct": _pct(r["w"], r["pts"]),
            "won_lte3_share_of_won_pct": _pct(r["w3"], r["w"]),
            "wide_pct": _pct(r["wide"], tot_dir),
            "body_pct": _pct(r["body"], tot_dir),
            "t_pct": _pct(r["t"], tot_dir),
        }

    # --- 回合结构（长度分桶：胜率 + 得失分方式） ---
    # MCP 的 pl1/pl2 以"先发球员"为基准，用 mcp_matches.p1 归位到本方视角。
    rows = _q(conn, f"""SELECT r."row" bucket, SUM(r.pts) pts,
               SUM(CASE WHEN m.p1=?1 THEN r.pl1_won ELSE r.pl2_won END) won,
               SUM(CASE WHEN m.p1=?1 THEN r.pl1_winners ELSE r.pl2_winners END) w,
               SUM(CASE WHEN m.p1=?1 THEN r.pl1_forced ELSE r.pl2_forced END) fe,
               SUM(CASE WHEN m.p1=?1 THEN r.pl1_unforced ELSE r.pl2_unforced END) ue
            FROM mcp_rally r JOIN mcp_matches m ON m.match_id = r.match_id
            WHERE (r.server=?1 OR r.returner=?1) AND r.match_id IN ({ph})
              AND r."row" IN ('1-3','4-6','7-9','10')
            GROUP BY r."row\"""",
        [name] + ids)
    if rows:
        buckets = {"1-3": "0_3", "4-6": "4_6", "7-9": "7_9", "10": "10p"}
        out["rally"] = {
            buckets[r["bucket"]]: {
                "pts": r["pts"], "win_pct": _pct(r["won"], r["pts"]),
                "winners": r["w"], "forced_err": r["fe"], "unforced": r["ue"],
            } for r in rows
        }

    # --- 网前 ---
    r = _q(conn, f"""SELECT SUM(net_pts) np, SUM(pts_won) w, SUM(passed_at_net) passed,
               SUM(total_shots) tot
            FROM mcp_net_points WHERE player=? AND match_id IN ({ph})""", base, one=True)
    if r and r["tot"]:
        out["net"] = {
            "net_freq_pct": _pct(r["np"], r["tot"]),
            "net_win_pct": _pct(r["w"], r["np"]),
            "passed_pct": _pct(r["passed"], r["np"]),
        }

    # --- 关键分（发球端）：破发点 vs 全场基线 ---
    r = conn.execute(
        f"""SELECT SUM(pts) pts, SUM(pts_won) w, SUM(first_in) fi, SUM(dfs) dfs
            FROM mcp_key_points_serve
            WHERE player=? AND match_id IN ({ph}) AND "row"='BP'""", base).fetchone()
    o = conn.execute(
        f"""SELECT SUM(serve_pts) pts, SUM(first_in) fi, SUM(dfs) dfs
            FROM mcp_overview
            WHERE player=? AND match_id IN ({ph}) AND "set"='Total'""", base).fetchone()
    if r and r["pts"] and o and o["pts"]:
        out["key_points_serve"] = {
            "bp_pts": r["pts"], "bp_won_pct": _pct(r["w"], r["pts"]),
            "bp_first_in_pct": _pct(r["fi"], r["pts"]),
            "overall_first_in_pct": _pct(o["fi"], o["pts"]),
            "bp_df_pct": _pct(r["dfs"], r["pts"]),
            "overall_df_pct": _pct(o["dfs"], o["pts"]),
        }

    # --- 接发深度 ---
    r = conn.execute(
        f"""SELECT SUM(returnable) ret, SUM(shallow) sh, SUM(deep) dp, SUM(very_deep) vd,
               SUM(unforced) ue, SUM(err_net+err_deep+err_wide+err_wide_deep) err
            FROM mcp_return_depth WHERE player=? AND match_id IN ({ph})""", base).fetchone()
    if r and r["ret"]:
        in_play = (r["sh"] or 0) + (r["dp"] or 0) + (r["vd"] or 0)
        out["return_depth"] = {
            "shallow_pct": _pct(r["sh"], in_play),
            "deep_pct": _pct(r["dp"], in_play),
            "very_deep_pct": _pct(r["vd"], in_play),
            "return_error_pct": _pct((r["ue"] or 0) + (r["err"] or 0), r["ret"]),
        }

    # --- 正反手翼：制胜/UE 分布 ---
    r = conn.execute(
        f"""SELECT SUM(winners_fh) wfh, SUM(winners_bh) wbh, SUM(unforced_fh) ufh,
               SUM(unforced_bh) ubh
            FROM mcp_overview
            WHERE player=? AND match_id IN ({ph}) AND "set"='Total'""", base).fetchone()
    if r and ((r["wfh"] or 0) + (r["wbh"] or 0) + (r["ufh"] or 0) + (r["ubh"] or 0)) > 0:
        ue_t = (r["ufh"] or 0) + (r["ubh"] or 0)
        w_t = (r["wfh"] or 0) + (r["wbh"] or 0)
        out["wings"] = {
            "fh_winners": r["wfh"], "bh_winners": r["wbh"],
            "fh_ue": r["ufh"], "bh_ue": r["ubh"],
            "ue_share_fh_pct": _pct(r["ufh"], ue_t),
            "winner_share_fh_pct": _pct(r["wfh"], w_t),
        }

    # --- 底线击球方向（正手/反手：斜线/中路/直线/侧身内/侧身内中） ---
    rows = conn.execute(
        f"""SELECT "row", SUM(crosscourt) cc, SUM(down_middle) dm, SUM(down_the_line) dl,
               SUM(inside_out) io, SUM(inside_in) ii
            FROM mcp_shot_direction
            WHERE player=? AND match_id IN ({ph}) AND "row" IN ('F','B')
            GROUP BY "row\"""", base).fetchall()
    if rows:
        wings = {}
        for r in rows:
            tot = (r["cc"] or 0) + (r["dm"] or 0) + (r["dl"] or 0) + (r["io"] or 0) + (r["ii"] or 0)
            wings["forehand" if r["row"] == "F" else "backhand"] = {
                "crosscourt_pct": _pct(r["cc"], tot),
                "middle_pct": _pct(r["dm"], tot),
                "line_pct": _pct(r["dl"], tot),
                "inside_out_pct": _pct(r["io"], tot),
                "inside_in_pct": _pct(r["ii"], tot),
            }
        out["shot_direction"] = wings
    return out
