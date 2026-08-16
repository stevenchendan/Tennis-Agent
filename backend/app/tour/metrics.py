"""高阶指标引擎：从业余"胜负战绩"到职业球探级别的技术统计。

所有比率只基于"完整完赛且有发球统计"的比赛（w_svpt 非空），退役/弃权
不计入分母，与 ATP 官方统计口径一致。保发率是估计值：被破发局数 ≤
丢失破发点数，用 bpFaced−bpSaved 近似（该数据集的行业通行做法）。

百分位基准：同巡回赛、同窗口（默认近 12 个月）、同场地的全体球员
分布，不只是"他自己的历史"。
"""

from __future__ import annotations

import bisect
import sqlite3
from dataclasses import dataclass, field


def pct(x: float | None, digits: int = 1) -> float | None:
    if x is None:
        return None
    return round(100 * x, digits)


def safe_div(a: float, b: float) -> float | None:
    return a / b if b else None


# ---------------------------------------------------------------------------
# 查询
# ---------------------------------------------------------------------------

@dataclass
class MatchFilter:
    tour: str | None = None          # atp / wta（player_id 跨巡回赛不唯一，必须限定）
    surface: str | None = None       # Clay / Hard / Grass / Carpet
    tiers: tuple[str, ...] | None = None   # ("main",) 巡回赛正赛；含 "secondary" 覆盖挑战赛/ITF
    levels: tuple[str, ...] | None = None  # G/M/PM/P/A/W/C/I/D/O
    date_from: str | None = None     # YYYYMMDD
    date_to: str | None = None
    tourney_id: str | None = None
    completed_only: bool = False

    def where(self, alias: str = "") -> tuple[str, list]:
        a = f"{alias}." if alias else ""
        clauses, args = [], []
        if self.tour:
            clauses.append(f"{a}tour = ?")
            args.append(self.tour)
        if self.surface:
            clauses.append(f"{a}surface = ?")
            args.append(self.surface)
        if self.tiers:
            clauses.append(f"{a}tier IN ({','.join('?' * len(self.tiers))})")
            args.extend(self.tiers)
        if self.levels:
            clauses.append(f"{a}tourney_level IN ({','.join('?' * len(self.levels))})")
            args.extend(self.levels)
        if self.date_from:
            clauses.append(f"{a}tourney_date >= ?")
            args.append(self.date_from)
        if self.date_to:
            clauses.append(f"{a}tourney_date <= ?")
            args.append(self.date_to)
        if self.tourney_id:
            clauses.append(f"{a}tourney_id = ?")
            args.append(self.tourney_id)
        if self.completed_only:
            clauses.append(f"{a}completed = 1")
        if not clauses:
            return ("1=1", [])
        return (" AND ".join(clauses), args)


# 球员视角的比赛行（胜者/败者统一方向），供聚合与近期表现使用。
_PLAYER_MATCH_SQL = """
SELECT m.tourney_date AS date, m.tourney_id, m.tourney_name, m.surface,
       m.tourney_level AS level, m.tier, m.round, m.best_of, m.minutes, m.score,
       m.completed, m.ret, m.wo, m.deciding,
       {opp_id} AS opp_id, {opp_name} AS opp_name, {opp_rank} AS opp_rank,
       {won} AS won,
       {sw} AS sets_w, {sl} AS sets_l, {gw} AS games_w, {gl} AS games_l,
       {tbw} AS tb_w, {tbl} AS tb_l,
       CASE WHEN {won}=1 THEN m.deciding_w ELSE 1-m.deciding_w END AS deciding_won,
       {m_svpt} AS m_svpt, {m_1stIn} AS m_1stIn, {m_1stWon} AS m_1stWon,
       {m_2ndWon} AS m_2ndWon, {m_SvGms} AS m_SvGms,
       {m_bpSaved} AS m_bpSaved, {m_bpFaced} AS m_bpFaced,
       {m_ace} AS m_ace, {m_df} AS m_df,
       {o_svpt} AS o_svpt, {o_1stIn} AS o_1stIn, {o_1stWon} AS o_1stWon,
       {o_2ndWon} AS o_2ndWon, {o_SvGms} AS o_SvGms,
       {o_bpSaved} AS o_bpSaved, {o_bpFaced} AS o_bpFaced,
       {o_ace} AS o_ace, {o_df} AS o_df
FROM matches m
WHERE {cond} AND m.winner_id = ?
UNION ALL
SELECT m.tourney_date, m.tourney_id, m.tourney_name, m.surface,
       m.tourney_level, m.tier, m.round, m.best_of, m.minutes, m.score,
       m.completed, m.ret, m.wo, m.deciding,
       {opp_id_l}, {opp_name_l}, {opp_rank_l},
       0,
       m.sets_l, m.sets_w, m.games_l, m.games_w,
       m.tb_l, m.tb_w,
       0,
       l_svpt, l_1stIn, l_1stWon, l_2ndWon, l_SvGms,
       l_bpSaved, l_bpFaced, l_ace, l_df,
       w_svpt, w_1stIn, w_1stWon, w_2ndWon, w_SvGms,
       w_bpSaved, w_bpFaced, w_ace, w_df
FROM matches m
WHERE {cond} AND m.loser_id = ?
ORDER BY date DESC
"""


def player_matches(
    conn: sqlite3.Connection, player_id: int, flt: MatchFilter | None = None
) -> list[dict]:
    """该球员的全部（或过滤后）比赛，统一为球员视角，按日期倒序。"""
    flt = flt or MatchFilter()
    cond, args = flt.where("m")
    sql = _PLAYER_MATCH_SQL.format(
        opp_id="m.loser_id", opp_name="m.loser_name", opp_rank="m.loser_rank", won=1,
        sw="m.sets_w", sl="m.sets_l", gw="m.games_w", gl="m.games_l",
        tbw="m.tb_w", tbl="m.tb_l",
        m_svpt="w_svpt", m_1stIn="w_1stIn", m_1stWon="w_1stWon",
        m_2ndWon="w_2ndWon", m_SvGms="w_SvGms", m_bpSaved="w_bpSaved",
        m_bpFaced="w_bpFaced", m_ace="w_ace", m_df="w_df",
        o_svpt="l_svpt", o_1stIn="l_1stIn", o_1stWon="l_1stWon",
        o_2ndWon="l_2ndWon", o_SvGms="l_SvGms", o_bpSaved="l_bpSaved",
        o_bpFaced="l_bpFaced", o_ace="l_ace", o_df="l_df",
        opp_id_l="m.winner_id", opp_name_l="m.winner_name", opp_rank_l="m.winner_rank",
        cond=cond,
    )
    rows = conn.execute(sql, args + [player_id] + args + [player_id]).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# 聚合：发球 / 接发 / 关键分
# ---------------------------------------------------------------------------

def _stat_rows(matches: list[dict]) -> list[dict]:
    """只保留完整完赛且有发球统计的比赛。"""
    return [m for m in matches if m["completed"] and m["m_svpt"]]


def serve_return_profile(matches: list[dict]) -> dict:
    """发球+接发全景。输入为球员视角比赛行。"""
    ms = _stat_rows(matches)
    n = len(ms)
    out: dict = {"matches": n}
    if not n:
        return out

    s = {k: sum(m[f"m_{k}"] or 0 for m in ms) for k in
         ("svpt", "1stIn", "1stWon", "2ndWon", "SvGms", "bpSaved", "bpFaced", "ace", "df")}
    o = {k: sum(m[f"o_{k}"] or 0 for m in ms) for k in
         ("svpt", "1stIn", "1stWon", "2ndWon", "SvGms", "bpSaved", "bpFaced", "ace", "df")}

    first_in = safe_div(s["1stIn"], s["svpt"])
    first_won = safe_div(s["1stWon"], s["1stIn"])
    second_won = safe_div(s["2ndWon"], s["svpt"] - s["1stIn"])
    spw = safe_div(s["1stWon"] + s["2ndWon"], s["svpt"])
    bp_lost = s["bpFaced"] - s["bpSaved"]
    hold = safe_div(s["SvGms"] - bp_lost, s["SvGms"])

    o_first_won = safe_div(o["1stWon"], o["1stIn"])
    o_second_won = safe_div(o["2ndWon"], o["svpt"] - o["1stIn"])
    rpw = safe_div(o["svpt"] - (o["1stWon"] + o["2ndWon"]), o["svpt"])
    o_bp_lost = o["bpFaced"] - o["bpSaved"]
    brk = safe_div(o_bp_lost, o["SvGms"])

    out.update({
        "serve": {
            "matches": n,
            "service_points": s["svpt"],
            "first_serve_pct": pct(first_in),
            "first_serve_won_pct": pct(first_won),
            "second_serve_won_pct": pct(second_won),
            "service_points_won_pct": pct(spw),
            "hold_pct": pct(hold),
            "ace_rate_pct": pct(safe_div(s["ace"], s["svpt"])),
            "df_rate_pct": pct(safe_div(s["df"], s["svpt"])),
            "df_on_2nd_serve_pct": pct(safe_div(s["df"], s["svpt"] - s["1stIn"])),
            "bp_faced_per_svc_game": round(s["bpFaced"] / s["SvGms"], 2) if s["SvGms"] else None,
            "bp_saved_pct": pct(safe_div(s["bpSaved"], s["bpFaced"])),
        },
        "return": {
            "matches": n,
            "return_points": o["svpt"],
            "return_vs_first_pct": pct(None if o_first_won is None else 1 - o_first_won),
            "return_vs_second_pct": pct(None if o_second_won is None else 1 - o_second_won),
            "return_points_won_pct": pct(rpw),
            "break_pct": pct(brk),
            "bp_converted_pct": pct(safe_div(o_bp_lost, o["bpFaced"])),
            "bp_earned_per_return_game": round(o["bpFaced"] / o["SvGms"], 2) if o["SvGms"] else None,
        },
    })
    if spw is not None and rpw is not None and spw < 1:
        # Dominance Ratio：接发得分率 ÷ 发球失分率。>1 表示统治比赛。
        out["dominance_ratio"] = round(rpw / (1 - spw), 3)
    if hold is not None and brk is not None:
        out["hold_plus_break_pct"] = pct(hold + brk)
    return out


def win_loss(matches: list[dict], exclude_walkovers: bool = True) -> dict:
    """战绩 + 分组细节（抢七/决胜盘/强敌）。"""
    ms = [m for m in matches if not (exclude_walkovers and m["wo"])]
    if not ms:
        return {"matches": 0}
    wins = sum(1 for m in ms if m["won"])
    out = {
        "matches": len(ms), "wins": wins, "losses": len(ms) - wins,
        "win_pct": pct(wins / len(ms)),
        "sets_won_pct": pct(sum(m["sets_w"] for m in ms if m["sets_w"] is not None) /
                            max(1, sum(m["sets_w"] + m["sets_l"] for m in ms if m["sets_w"] is not None))),
        "tb_w": sum(m["tb_w"] or 0 for m in ms),
        "tb_l": sum(m["tb_l"] or 0 for m in ms),
        "deciding_w": sum(1 for m in ms if m["deciding"] and m["deciding_won"]),
        "deciding_l": sum(1 for m in ms if m["deciding"] and not m["deciding_won"]),
        "three_set_matches": sum(1 for m in ms if (m["sets_w"] or 0) + (m["sets_l"] or 0) >= 3
                                 and (m["best_of"] or 3) == 3),
    }
    tb_total = out["tb_w"] + out["tb_l"]
    if tb_total:
        out["tb_win_pct"] = pct(out["tb_w"] / tb_total)
    dec = out["deciding_w"] + out["deciding_l"]
    if dec:
        out["deciding_win_pct"] = pct(out["deciding_w"] / dec)
    # 对阵不同档次对手的战绩（按当场比赛时的排名）
    for label, hi in (("vs_top10", 10), ("vs_top50", 50)):
        sub = [m for m in ms if m["opp_rank"] is not None and m["opp_rank"] <= hi]
        if sub:
            out[label] = {
                "matches": len(sub), "wins": sum(1 for m in sub if m["won"]),
                "losses": len(sub) - sum(1 for m in sub if m["won"]),
            }
    return out


def fatigue(matches: list[dict], today: str | None = None) -> dict:
    """负荷与疲劳：职业教练赛前必看的一组数据。"""
    import datetime as dt

    if not matches:
        return {}
    dates = [m["date"] for m in matches if m["date"]]
    today = today or max(dates)  # 数据窗口末日当"今天"，避免数据滞后导致全零
    t = dt.datetime.strptime(today, "%Y%m%d").date()

    def _days_ago(d: str) -> int:
        return (t - dt.datetime.strptime(d, "%Y%m%d").date()).days

    last28 = [m for m in matches if m["date"] and _days_ago(m["date"]) < 28 and m["date"] <= today]
    last30 = [m for m in matches if m["date"] and _days_ago(m["date"]) < 30 and m["date"] <= today]
    recent5 = matches[:5]
    minutes = [m["minutes"] for m in recent5 if m["minutes"]]
    return {
        "matches_28d": len(last28),
        "three_setters_30d": sum(1 for m in last30
                                 if (m["sets_w"] or 0) + (m["sets_l"] or 0) >= 3),
        "minutes_last_5_avg": round(sum(minutes) / len(minutes)) if minutes else None,
        "retirements_90d": sum(1 for m in matches
                               if m["ret"] and m["date"] and _days_ago(m["date"]) < 90),
        "rest_days": _days_ago(max((m["date"] for m in matches if m["date"] <= today),
                                   default=today)),
    }


def recent_form(matches: list[dict], ns: tuple[int, ...] = (10, 25)) -> dict:
    """近期状态：近 N 场胜负、连胜/连败、击败过的最高排名、对手质量。

    walkover 不计入（与官方活动战绩口径一致）；退役局算胜负。
    """
    out: dict = {}
    playable = [m for m in matches if not m["wo"]]
    for n in ns:
        recent = playable[:n]
        if not recent:
            continue
        wins = [m for m in recent if m["won"]]
        losses = [m for m in recent if not m["won"]]
        beaten_ranks = [m["opp_rank"] for m in wins if m["opp_rank"]]
        lost_ranks = [m["opp_rank"] for m in losses if m["opp_rank"]]
        # 正 = 连胜场数；负 = 连败场数（matches[0] 为最近一场）
        streak = 0
        if recent[0]["won"]:
            for m in recent:
                if m["won"]:
                    streak += 1
                else:
                    break
        else:
            for m in recent:
                if not m["won"]:
                    streak -= 1
                else:
                    break
        out[f"last{n}"] = {
            "matches": len(recent), "wins": len(wins), "losses": len(losses),
            "win_pct": pct(len(wins) / len(recent)),
            "streak": streak,
            "best_win_rank": min(beaten_ranks) if beaten_ranks else None,
            "worst_loss_rank": max(lost_ranks) if lost_ranks else None,
            "avg_rank_beaten": round(sum(beaten_ranks) / len(beaten_ranks)) if beaten_ranks else None,
            "avg_rank_lost_to": round(sum(lost_ranks) / len(lost_ranks)) if lost_ranks else None,
        }
    return out


# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# 巡回赛百分位：同巡回赛、同窗口、同场地的人群分布
# ---------------------------------------------------------------------------

_SERVE_AGG_SQL = """
WITH svc AS (
    SELECT winner_id AS pid,
           SUM(w_svpt) svpt, SUM(w_1stIn) f1, SUM(w_1stWon) w1, SUM(w_2ndWon) w2,
           SUM(w_SvGms) gms, SUM(w_bpSaved) bps, SUM(w_bpFaced) bpf,
           SUM(w_ace) aces, SUM(w_df) dfs
    FROM matches WHERE {cond} AND completed = 1 AND w_svpt IS NOT NULL AND tour = ?
    GROUP BY winner_id
    UNION ALL
    SELECT loser_id,
           SUM(l_svpt), SUM(l_1stIn), SUM(l_1stWon), SUM(l_2ndWon),
           SUM(l_SvGms), SUM(l_bpSaved), SUM(l_bpFaced),
           SUM(l_ace), SUM(l_df)
    FROM matches WHERE {cond} AND completed = 1 AND l_svpt IS NOT NULL AND tour = ?
    GROUP BY loser_id
)
SELECT pid, SUM(svpt) svpt, SUM(f1) f1, SUM(w1) w1, SUM(w2) w2,
       SUM(gms) gms, SUM(bps) bps, SUM(bpf) bpf, SUM(aces) aces, SUM(dfs) dfs
FROM svc GROUP BY pid
"""

_RETURN_AGG_SQL = """
WITH ret AS (
    -- 球员作为败方时，胜者(对手)的发球数据即球员的接发对象
    SELECT loser_id AS pid,
           SUM(w_svpt) osvpt, SUM(w_1stWon) ow1, SUM(w_2ndWon) ow2,
           SUM(w_SvGms) ogms, SUM(w_bpSaved) obps, SUM(w_bpFaced) obpf
    FROM matches WHERE {cond} AND completed = 1 AND w_svpt IS NOT NULL AND tour = ?
    GROUP BY loser_id
    UNION ALL
    SELECT winner_id,
           SUM(l_svpt), SUM(l_1stWon), SUM(l_2ndWon),
           SUM(l_SvGms), SUM(l_bpSaved), SUM(l_bpFaced)
    FROM matches WHERE {cond} AND completed = 1 AND l_svpt IS NOT NULL AND tour = ?
    GROUP BY winner_id
)
SELECT pid, SUM(osvpt) osvpt, SUM(ow1) ow1, SUM(ow2) ow2,
       SUM(ogms) ogms, SUM(obps) obps, SUM(obpf) obpf
FROM ret GROUP BY pid
"""


def population_percentiles(
    conn: sqlite3.Connection,
    tour: str,
    player_values: dict,
    flt: MatchFilter | None = None,
    min_points: int = 800,
) -> dict:
    """给定球员的一组指标值，返回同巡回赛人群中的百分位。

    population = 窗口内自己发球分总数 >= min_points 的球员（约 15+ 场）。
    每个指标独立取非空值排序；percentile = 人群中低于该值的比例。
    """
    flt = flt or MatchFilter()
    cond, args = flt.where()

    serve = {
        r["pid"]: r for r in conn.execute(
            _SERVE_AGG_SQL.format(cond=cond), args + [tour] + args + [tour]
        )
    }
    ret = {
        r["pid"]: r for r in conn.execute(
            _RETURN_AGG_SQL.format(cond=cond), args + [tour] + args + [tour]
        )
    }

    dists: dict[str, list[float]] = {}
    for pid, s in serve.items():
        if s["svpt"] < min_points or pid not in ret:
            continue
        o = ret[pid]
        svpt, f1, w1, w2 = s["svpt"], s["f1"], s["w1"], s["w2"]
        gms, bps, bpf = s["gms"], s["bps"], s["bpf"]
        spw = safe_div(w1 + w2, svpt)
        rpw = safe_div(o["osvpt"] - (o["ow1"] + o["ow2"]), o["osvpt"])
        obp_lost = o["obpf"] - o["obps"]
        vals = {
            "hold_pct": pct(safe_div(gms - (bpf - bps), gms)),
            "break_pct": pct(safe_div(obp_lost, o["ogms"])),
            "service_points_won_pct": pct(spw),
            "return_points_won_pct": pct(rpw),
            "first_serve_pct": pct(safe_div(f1, svpt)),
            "first_serve_won_pct": pct(safe_div(w1, f1)),
            "second_serve_won_pct": pct(safe_div(w2, svpt - f1)),
            "ace_rate_pct": pct(safe_div(s["aces"], svpt)),
            "df_rate_pct": pct(safe_div(s["dfs"], svpt)),
            "bp_saved_pct": pct(safe_div(bps, bpf)),
            "bp_converted_pct": pct(safe_div(obp_lost, o["obpf"])),
        }
        if spw is not None and rpw is not None and spw < 1:
            vals["dominance_ratio"] = round(rpw / (1 - spw), 3)
        for k, v in vals.items():
            if v is not None:
                dists.setdefault(k, []).append(v)

    for d in dists.values():
        d.sort()

    out: dict = {}
    for k, v in player_values.items():
        if v is None or k not in dists or len(dists[k]) < 30:
            continue
        d = dists[k]
        pos = bisect.bisect_left(d, v)
        out[k] = {
            "value": v,
            "percentile": round(100 * pos / len(d)),
            "population": len(d),
            "tour_median": round(d[len(d) // 2], 1),
        }
    return out
