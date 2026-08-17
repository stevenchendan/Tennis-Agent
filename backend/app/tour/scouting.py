"""球探报告生成器：给定对手（+场地/赛事/我方球员），产出职业级赛前报告。

报告 JSON 由确定性规则组装（保发/破发/统治率/百分位/关键分/负荷/H2H/
场馆史/风格标签/战术建议），LLM 只作为可选的"教练视角"叙述层叠加其上，
与视频分析报告同款降级策略：无 key 也有完整可用报告。
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from app.tour import charting as tour_charting
from app.tour import db as tour_db
from app.tour import metrics


def _months_before(yyyymmdd: str, months: int) -> str:
    import datetime as dt

    d = dt.datetime.strptime(yyyymmdd, "%Y%m%d").date()
    m = d.month - months
    y = d.year + (m - 1) // 12
    m = (m - 1) % 12 + 1
    day = min(d.day, [31, 29 if y % 4 == 0 and (y % 100 != 0 or y % 400 == 0) else 28,
                      31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1])
    return f"{y:04d}{m:02d}{day:02d}"


def _data_to(conn: sqlite3.Connection) -> str | None:
    row = conn.execute("SELECT value FROM meta WHERE key='data_to'").fetchone()
    return row["value"] if row else None


# ---------------------------------------------------------------------------
# 查询服务：搜索 / 详情 / 赛事
# ---------------------------------------------------------------------------

def search_players(conn: sqlite3.Connection, q: str, limit: int = 20) -> list[dict]:
    q = q.strip()
    if len(q) < 2:
        return []
    sql = """
    SELECT p.player_id, p.name, p.tour, p.hand, p.ioc, p.dob, p.height, r.rank AS current_rank,
           e.elo_overall
    FROM players p
    LEFT JOIN rankings r
        ON r.player_id = p.player_id AND r.tour = p.tour
        AND r.ranking_date = (SELECT MAX(ranking_date) FROM rankings WHERE tour = p.tour)
    LEFT JOIN elo e ON e.player_id = p.player_id AND e.tour = p.tour
    WHERE p.name LIKE ? ESCAPE '\\'
    ORDER BY (r.rank IS NULL), r.rank, e.elo_overall DESC
    LIMIT ?
    """
    like = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    rows = conn.execute(sql, (f"%{like}%", limit)).fetchall()
    return [dict(r) for r in rows]


def player_core(conn: sqlite3.Connection, player_id: int, tour: str) -> dict | None:
    p = conn.execute(
        "SELECT * FROM players WHERE player_id = ? AND tour = ?", (player_id, tour)
    ).fetchone()
    if not p:
        return None
    out = dict(p)
    latest = conn.execute(
        "SELECT MAX(ranking_date) FROM rankings WHERE tour = ?", (tour,)
    ).fetchone()[0]
    cur = conn.execute(
        "SELECT rank, points, ranking_date FROM rankings WHERE tour=? AND player_id=? "
        "AND ranking_date=?",
        (tour, player_id, latest),
    ).fetchone()
    if cur:
        out["current_rank"] = cur["rank"]
        out["current_points"] = cur["points"]
        out["rank_date"] = cur["ranking_date"]
    peak = conn.execute(
        "SELECT MIN(rank) FROM rankings WHERE tour=? AND player_id=?", (tour, player_id)
    ).fetchone()[0]
    if peak:
        out["peak_rank"] = peak
    elo = conn.execute(
        "SELECT * FROM elo WHERE player_id=? AND tour=?", (player_id, tour)
    ).fetchone()
    if elo and elo["elo_n"] >= 20:
        e = dict(elo)
        rank_row = conn.execute(
            "SELECT COUNT(*)+1 FROM elo WHERE tour=? AND elo_overall > ?",
            (tour, e["elo_overall"]),
        ).fetchone()
        e["elo_rank"] = rank_row[0]
        out["elo"] = e
    if out.get("dob"):
        import datetime as dt

        try:
            dob = dt.datetime.strptime(str(out["dob"]), "%Y%m%d").date()
            ref = conn.execute("SELECT value FROM meta WHERE key='data_to'").fetchone()
            ref_date = dt.datetime.strptime(ref["value"], "%Y%m%d").date() if ref else dt.date.today()
            out["age"] = round((ref_date - dob).days / 365.25, 1)
        except ValueError:
            pass
    return out


def tournaments(conn: sqlite3.Connection, months: int = 18) -> list[dict]:
    """近 N 个月出现过的赛事（按巡回赛去重，供报告上下文选择）。"""
    to = _data_to(conn) or "99991231"
    frm = _months_before(to, months)
    rows = conn.execute(
        """
        SELECT tourney_id, tourney_name, surface, tourney_level, tour, tier,
               COUNT(*) AS n
        FROM matches
        WHERE tourney_date >= ? AND tourney_date <= ? AND tier = 'main'
        GROUP BY tourney_id, tour
        ORDER BY tourney_date DESC
        """,
        (frm, to),
    ).fetchall()
    # 同一巡回赛每年 tourney_id 带年份前缀，按去前缀的 base + tour 去重取最近一届
    seen: dict[tuple, dict] = {}
    for r in rows:
        base = r["tourney_id"].split("-", 1)[1] if "-" in r["tourney_id"] else r["tourney_id"]
        key = (r["tour"], base)
        cur = seen.get(key)
        item = dict(r)
        item["tourney_base"] = base
        if cur is None or item["tourney_id"] > cur["tourney_id"]:
            seen[key] = item
    out = sorted(
        seen.values(),
        key=lambda x: (-x["n"], x["tourney_name"]),
    )
    return out


def _h2h(conn: sqlite3.Connection, tour: str, a: int, b: int) -> dict | None:
    rows = conn.execute(
        """
        SELECT tourney_date AS date, tourney_name, surface, score, winner_id,
               winner_name, loser_name, winner_rank, loser_rank, completed, ret, wo
        FROM matches
        WHERE tour = ?
          AND ((winner_id = ? AND loser_id = ?) OR (winner_id = ? AND loser_id = ?))
        ORDER BY tourney_date DESC
        """,
        (tour, a, b, b, a),
    ).fetchall()
    if not rows:
        return None
    ms = [dict(r) for r in rows]
    wins_a = sum(1 for m in ms if m["winner_id"] == a)
    return {
        "matches": len(ms),
        "wins": wins_a,
        "losses": len(ms) - wins_a,
        "list": [
            {
                "date": m["date"], "tournament": m["tourney_name"], "surface": m["surface"],
                "score": m["score"], "won": m["winner_id"] == a,
                "opponent_rank_at_match": (m["loser_rank"] if m["winner_id"] == a else m["winner_rank"]),
            }
            for m in ms
        ],
    }


# ---------------------------------------------------------------------------
# 风格标签与战术建议（规则引擎，全部带证据）
# ---------------------------------------------------------------------------

def _get(d: dict, *path, default=None):
    cur = d
    for k in path:
        if cur is None:
            return default
        cur = cur.get(k) if isinstance(cur, dict) else None
    return cur if cur is not None else default


def style_tags(profile: dict, perc: dict, surface_split: dict | None) -> list[dict]:
    tags: list[dict] = []

    def p(key) -> int | None:
        return _get(perc, key, "percentile", default=None)

    hold_p, break_p = p("hold_pct"), p("break_pct")
    ace_p, bp_save_p, bp_conv_p = p("ace_rate_pct"), p("bp_saved_pct"), p("bp_converted_pct")
    if hold_p is not None and hold_p >= 80 and (ace_p or 0) >= 70:
        tags.append({"tag": "发球主导型", "why": f"保发率巡回赛前 20%（第 {hold_p} 百分位）"})
    if break_p is not None and break_p >= 80:
        tags.append({"tag": "接发压制型", "why": f"破发率巡回赛前 20%（第 {break_p} 百分位）"})
    if hold_p is not None and hold_p >= 65 and (break_p or 0) >= 65:
        tags.append({"tag": "两端均衡的全面型", "why": f"保发/破发均在前 35%（{hold_p}/{break_p} 百分位）"})
    if bp_save_p is not None and bp_conv_p is not None and bp_save_p >= 75 and bp_conv_p >= 75:
        tags.append({"tag": "关键分型选手", "why": f"救破发点/兑现破发点均在前 25%（{bp_save_p}/{bp_conv_p}）"})
    wl = profile.get("win_loss") or {}
    tb_pct = wl.get("tb_win_pct")
    if tb_pct is not None and tb_pct >= 65 and (wl.get("tb_w", 0) + wl.get("tb_l", 0)) >= 8:
        tags.append({"tag": "抢七大心脏", "why": f"抢七胜率 {tb_pct:.0f}%（{wl.get('tb_w',0)}胜{wl.get('tb_l',0)}负）"})
    dec_pct = wl.get("deciding_win_pct")
    if dec_pct is not None and dec_pct >= 65 and (wl.get("deciding_w", 0) + wl.get("deciding_l", 0)) >= 8:
        tags.append({"tag": "鏖战不落下风", "why": f"决胜盘胜率 {dec_pct:.0f}%"})
    hand = _get(profile, "player", "hand")
    if hand == "L":
        tags.append({"tag": "左手持拍", "why": "左手发球与正手斜线会打出与多数对手相反的旋转/角度"})
    if surface_split:
        best = max(surface_split.items(), key=lambda kv: kv[1].get("win_pct") or 0)
        worst = min(surface_split.items(), key=lambda kv: kv[1].get("win_pct") or 100)
        if best[1].get("win_pct") and worst[1].get("win_pct") and \
                best[1]["win_pct"] - worst[1]["win_pct"] >= 15 and best[1].get("matches", 0) >= 10:
            cn = {"Clay": "红土", "Hard": "硬地", "Grass": "草地"}
            tags.append({
                "tag": f"{cn.get(best[0], best[0])}专家",
                "why": f"{cn.get(best[0], best[0])}胜率 {best[1]['win_pct']:.0f}% vs "
                       f"{cn.get(worst[0], worst[0])} {worst[1]['win_pct']:.0f}%",
            })
    return tags[:5]


def build_tactics(opp: dict, prof_s: dict, perc: dict, form: dict, fatigue: dict,
                  surface: str | None, h2h: dict | None, venue: dict | None,
                  tour: str = "atp") -> list[dict]:
    """规则战术库：每条含标题/证据/执行细节，全部由数字触发。"""
    t: list[dict] = []

    def val(key):
        return _get(prof_s, "serve", key) or _get(prof_s, "return", key)

    def med(key):
        return _get(perc, key, "tour_median")

    def pctl(key):
        return _get(perc, key, "percentile")

    second = _get(prof_s, "serve", "second_serve_won_pct")
    if second is not None and pctl("second_serve_won_pct") is not None and \
            pctl("second_serve_won_pct") <= 30:
        t.append({
            "title": "主攻他的二发",
            "evidence": f"二发得分率 {second}%（巡回赛中位 {med('second_serve_won_pct')}%，"
                        f"第 {pctl('second_serve_won_pct')} 百分位）",
            "detail": "接二发站位至少踩进底线内，第一拍就抢攻中路深区或追身，"
                      "把三分之二以上的二发回合变成进攻回合。",
        })
    hold = _get(prof_s, "serve", "hold_pct")
    if hold is not None and pctl("hold_pct") is not None and pctl("hold_pct") <= 35:
        t.append({
            "title": "他的发球局是最薄弱环节",
            "evidence": f"保发率 {hold}%（巡回赛中位 {med('hold_pct')}%，第 {pctl('hold_pct')} 百分位）",
            "detail": "接发环节投入最多的赛前训练量：一发回深、二发抢攻，"
                      "每局 30-30 后果断加压，把比赛拖入互破节奏对他不利时其实对你有利。",
        })
    first_in = _get(prof_s, "serve", "first_serve_pct")
    if first_in is not None and pctl("first_serve_pct") is not None and pctl("first_serve_pct") <= 30:
        t.append({
            "title": "一发成功率低 → 准备好多拍二发回合",
            "evidence": f"一发成功率 {first_in}%（巡回赛中位 {med('first_serve_pct')}%，"
                        f"第 {pctl('first_serve_pct')} 百分位）",
            "detail": "他每 10 分约有 4 分要靠二发起步。二发回合的战术要提前演练："
                      "接深 + 下一拍抢中线，避免把二发回合打成五五开相持。",
        })
    bp_save = _get(prof_s, "serve", "bp_saved_pct")
    if bp_save is not None and pctl("bp_saved_pct") is not None and pctl("bp_saved_pct") <= 35:
        t.append({
            "title": "关键分（破发点）抗压偏弱",
            "evidence": f"救破发点率 {bp_save}%（巡回赛中位 {med('bp_saved_pct')}%，"
                        f"第 {pctl('bp_saved_pct')} 百分位）",
            "detail": "拿到破发点时不要保守：直接采用你把握最高的攻击性回球组合"
                      "（如接发抢攻+上网），他的破发点表现低于巡回赛平均。",
        })
    brk = _get(prof_s, "return", "break_pct")
    if brk is not None and pctl("break_pct") is not None and pctl("break_pct") >= 70:
        t.append({
            "title": "他的接发会咬人：保住自己发球局是底线",
            "evidence": f"破发率 {brk}%（第 {pctl('break_pct')} 百分位）",
            "detail": "一发落点与旋转要多样化（不要让他的接发站位站死），二发避免同一落点"
                      "连续出现；把发球局的战术重心放在发球+第一拍衔接，而不是追求 ACE。",
        })
    rpw = _get(prof_s, "return", "return_points_won_pct")
    if rpw is not None and pctl("return_points_won_pct") is not None and pctl("return_points_won_pct") >= 75:
        t.append({
            "title": "接发得分率高：避免与他打接发后的攻防转换",
            "evidence": f"接发得分率 {rpw}%（第 {pctl('return_points_won_pct')} 百分位）",
            "detail": "发球后第一拍要主动变线拉开场地，不要把回球喂到他击球舒适区；"
                      "多发追身与身体左侧（右手持拍的反手位）挤压其引拍。",
        })
    ace = _get(prof_s, "serve", "ace_rate_pct")
    if ace is not None and pctl("ace_rate_pct") is not None and pctl("ace_rate_pct") >= 80:
        t.append({
            "title": "接一发：先求回过、再求回深",
            "evidence": f"ACE 率 {ace}%（第 {pctl('ace_rate_pct')} 百分位，巡回赛中位 {med('ace_rate_pct')}%）",
            "detail": "接一发站位退后 0.5-1m，用挡接把球回到中路深区，把一分打成相持；"
                      "他的发球局价值主要在一发，进入相持后你的胜率回升。",
        })
    df = _get(prof_s, "serve", "df_rate_pct")
    if df is not None and pctl("df_rate_pct") is not None and pctl("df_rate_pct") >= 80:
        t.append({
            "title": "关键分离他的一发越远越好",
            "evidence": f"双误率 {df}%（第 {pctl('df_rate_pct')} 百分位）",
            "detail": "他在压力分（30-30、抢七）双误倾向高：接发站位略压上制造回球威胁，"
                      "迫使他二发追求质量而不是安全性。",
        })
    wl = _get(prof_s, "win_loss") or {}
    dec = wl.get("deciding_win_pct")
    if dec is not None and wl.get("deciding_w", 0) + wl.get("deciding_l", 0) >= 10:
        if dec <= 40:
            t.append({
                "title": "拖入决胜盘/鏖战对他不利",
                "evidence": f"决胜盘胜率 {dec:.0f}%（{wl.get('deciding_w')}胜{wl.get('deciding_l')}负）",
                "detail": "即使丢掉首盘，把比赛拖长在概率上对你有利；体能分配上敢于打持久战。",
            })
        elif dec >= 60:
            t.append({
                "title": "他要的是鏖战，你要的是速胜",
                "evidence": f"决胜盘胜率 {dec:.0f}%（{wl.get('deciding_w')}胜{wl.get('deciding_l')}负）",
                "detail": "争取前两盘解决战斗：领先时保持攻击性、压缩局间休息时间，"
                          "避免把比赛拖入他的决胜盘舒适区。",
            })
    if surface == "Clay":
        clay_elo = _get(opp, "elo", "elo_clay")
        overall_elo = _get(opp, "elo", "elo_overall")
        if clay_elo and overall_elo and overall_elo - clay_elo >= 100:
            t.append({
                "title": "红土明显非其舒适区：用高弹跳与上旋压制",
                "evidence": f"红土 Elo {clay_elo:.0f} vs 整体 {overall_elo:.0f}（低 100+）",
                "detail": "多用上旋把球打高打深，逼他在肩部以上击球；节奏上多放小球"
                          "与月亮球变化，破坏他偏快节奏的击球习惯。",
            })
    if surface in ("Grass", "Hard"):
        s_elo = _get(opp, "elo", "elo_grass" if surface == "Grass" else "elo_hard")
        overall_elo = _get(opp, "elo", "elo_overall")
        if s_elo and overall_elo and overall_elo - s_elo >= 100:
            cn = "草地" if surface == "Grass" else "硬地"
            t.append({
                "title": f"他并不适应{cn}：把比赛打成快速回合",
                "evidence": f"{cn} Elo {s_elo:.0f} vs 整体 {overall_elo:.0f}",
                "detail": "压缩击球节奏、多打平击与低平弧线，减少他喜欢的上旋弹跳；"
                          "发球上网与切入在他不擅长的场地上性价比更高。",
            })
    m28 = fatigue.get("matches_28d")
    if m28 is not None and m28 >= 12:
        t.append({
            "title": "他近期赛程密集：多拍相持是武器",
            "evidence": f"过去 28 天打了 {m28} 场比赛",
            "detail": "相持中多打斜线调动与反复变线，延长每一分；他的疲劳会在"
                      "第二三盘的移动质量上兑现成你的机会球。",
        })
    if h2h and h2h.get("matches", 0) >= 3:
        w, l = h2h["wins"], h2h["losses"]
        side = "占优" if w > l else ("下风" if w < l else "均势")
        t.append({
            "title": f"H2H 你 {w} 胜 {l} 负（{side}）",
            "evidence": f"历史交手 {h2h['matches']} 次",
            "detail": "重看最近两次交手的制胜/致败模式：H2H 中的技战术惯性比泛化数据更可靠。",
        })
    if venue and venue.get("matches", 0) >= 5:
        vw = venue.get("win_pct")
        t.append({
            "title": f"该场馆历史战绩 {venue.get('wins',0)}胜{venue.get('losses',0)}负"
                     + (f"（胜率 {vw:.0f}%）" if vw is not None else ""),
            "evidence": f"在此赛事共 {venue['matches']} 场",
            "detail": "场馆/气候适应性是他的一部分：如果胜率明显低于其总体水平，"
                      "开局阶段大胆施压可以放大他的不适。",
        })
    if tour == "wta":
        # 战术文案默认"他"；WTA 报告统一替换为"她"
        for item in t:
            for k in ("title", "evidence", "detail"):
                item[k] = item[k].replace("他", "她")
    return t[:8]


# ---------------------------------------------------------------------------
# 报告组装
# ---------------------------------------------------------------------------

def build_report(
    db_path: Path,
    opponent_id: int,
    tour: str = "atp",
    client_id: int | None = None,
    surface: str | None = None,
    tournament_id: str | None = None,
    months: int = 12,
    include_secondary: bool = False,
) -> dict:
    conn = tour_db.get_conn(db_path)
    data_to = _data_to(conn)
    opponent = player_core(conn, opponent_id, tour)
    if not opponent:
        raise KeyError(f"player {opponent_id} not found in {tour}")

    tiers = ("main", "secondary") if include_secondary else ("main",)
    venue = None
    if tournament_id:
        t = conn.execute(
            "SELECT tourney_id, tourney_name, surface, tourney_level FROM matches "
            "WHERE tourney_id = ? AND tour = ? LIMIT 1",
            (tournament_id, tour),
        ).fetchone()
        if t:
            venue_info = dict(t)
            surface = surface or venue_info["surface"]
            venue_base = tournament_id.split("-", 1)[1] if "-" in tournament_id else tournament_id
            vrows = conn.execute(
                "SELECT DISTINCT tourney_id FROM matches WHERE tour = ? "
                "AND SUBSTR(tourney_id, INSTR(tourney_id,'-')+1) = ?",
                (tour, venue_base),
            ).fetchall()
            vids = [r["tourney_id"] for r in vrows] or [tournament_id]
            vm = []
            for vid in vids:
                flt_v = metrics.MatchFilter(
                    tour=tour, tiers=tiers, tourney_id=vid,
                    date_from=_months_before(data_to, 84),
                )
                vm.extend(metrics.player_matches(conn, opponent_id, flt_v))
            vm.sort(key=lambda x: x["date"], reverse=True)
            wins = sum(1 for m in vm if m["won"] and not m["wo"])
            losses = sum(1 for m in vm if not m["won"] and not m["wo"])
            venue = {
                "tournament": venue_info,
                "matches": len(vm), "wins": wins, "losses": losses,
                "win_pct": metrics.pct(wins / (wins + losses)) if wins + losses else None,
                "list": [
                    {"date": m["date"], "round": m["round"], "won": m["won"],
                     "opp_name": m["opp_name"], "score": m["score"]}
                    for m in vm[:12]
                ],
            }

    date_from = _months_before(data_to, months) if data_to else None
    base_flt = metrics.MatchFilter(tour=tour, tiers=tiers, date_from=date_from)

    # 主窗口：全部场地；场地窗口：指定场地（近 12 个月，不足则放宽到 36 个月）
    m_all = metrics.player_matches(conn, opponent_id, base_flt)
    prof_all = metrics.serve_return_profile(m_all)
    wl_all = metrics.win_loss(m_all)
    prof_all["win_loss"] = wl_all

    prof_s, wl_s = prof_all, wl_all
    m_s = m_all
    if surface:
        m_s = metrics.player_matches(conn, opponent_id,
                                     metrics.MatchFilter(tour=tour, tiers=tiers, surface=surface,
                                                         date_from=date_from))
        prof_s = metrics.serve_return_profile(m_s)
        wl_s = metrics.win_loss(m_s)
        prof_s["win_loss"] = wl_s
        if prof_s.get("matches", 0) < 6:
            wide_from = _months_before(data_to, 36) if data_to else None
            m_s = metrics.player_matches(conn, opponent_id,
                                         metrics.MatchFilter(tour=tour, tiers=tiers, surface=surface,
                                                             date_from=wide_from))
            prof_s = metrics.serve_return_profile(m_s)
            wl_s = metrics.win_loss(m_s)
            prof_s["win_loss"] = wl_s

    # 百分位（与场地窗口同口径的人群）。红土/草地单场地赛季短，
    # 门槛降为 350 发球分；人群仍不足则放宽到 24 个月窗口。
    perc_values = {**(prof_s.get("serve") or {}), **(prof_s.get("return") or {})}
    perc_values.pop("matches", None)
    if "dominance_ratio" in prof_s:
        perc_values["dominance_ratio"] = prof_s["dominance_ratio"]
    perc_flt = metrics.MatchFilter(tiers=tiers, surface=surface, date_from=date_from)
    perc = metrics.population_percentiles(
        conn, tour, perc_values, perc_flt,
        min_points=800 if not surface else 350,
    )
    if not perc and surface:
        perc_flt.date_from = _months_before(data_to, 24) if data_to else None
        perc = metrics.population_percentiles(
            conn, tour, perc_values, perc_flt, min_points=350,
        )

    # 分场地画像（近 36 个月，展示他的场地基因）
    surface_split: dict[str, dict] = {}
    for s in ("Clay", "Hard", "Grass"):
        sm = metrics.player_matches(conn, opponent_id,
                                    metrics.MatchFilter(tour=tour, tiers=tiers, surface=s,
                                                        date_from=_months_before(data_to, 36)))
        swl = metrics.win_loss(sm)
        if swl.get("matches"):
            sr = metrics.serve_return_profile(sm)
            surface_split[s] = {
                "matches": swl["matches"], "win_pct": swl.get("win_pct"),
                "hold_pct": _get(sr, "serve", "hold_pct"),
                "break_pct": _get(sr, "return", "break_pct"),
            }

    # 近期状态 / 负荷（不限场地，近 12 个月）
    form = metrics.recent_form(m_all)
    fat = metrics.fatigue(m_all, today=data_to)
    recent_list = [
        {
            "date": m["date"], "tournament": m["tourney_name"], "surface": m["surface"],
            "level": m["level"], "round": m["round"], "won": bool(m["won"]),
            "score": m["score"], "opponent": m["opp_name"],
            "opponent_rank": m["opp_rank"], "minutes": m["minutes"],
        }
        for m in m_all[:15]
    ]

    h2h = _h2h(conn, tour, client_id, opponent_id) if client_id else None
    tags = style_tags({"player": opponent, "win_loss": wl_s}, perc, surface_split)
    tactics = build_tactics(opponent, prof_s, perc, form.get("last10", {}), fat,
                            surface, h2h, venue, tour=tour)

    # 微观层（图表化数据）：样本不足时自动缺失/降级，不阻塞宏观报告
    chart = None
    try:
        chart = tour_charting.player_profile(conn, opponent_id, tour,
                                             surface=surface, months=36)
    except Exception as e:  # noqa: BLE001
        chart = {"insufficient": True, "error": str(e), "sample_matches": 0}
    if chart and not chart.get("insufficient"):
        tactics.extend(charting_tactics(chart))
        tactics = tactics[:10]

    report = {
        "opponent": opponent,
        "context": {"surface": surface, "tournament": venue["tournament"] if venue else None,
                    "months": months, "include_secondary": include_secondary,
                    "client_id": client_id},
        "style_tags": tags,
        "window_stats": prof_all,
        "surface_stats": prof_s if surface else None,
        "percentiles": perc,
        "surface_split": surface_split,
        "recent_form": form,
        "fatigue": fat,
        "recent_matches": recent_list,
        "h2h": h2h,
        "venue": venue,
        "tactics": tactics,
        "charting": chart,
        "data_window": {
            "from": date_from, "to": data_to,
            "synced_at": conn.execute(
                "SELECT value FROM meta WHERE key='synced_at'"
            ).fetchone()["value"],
        },
    }
    return report


def charting_tactics(chart: dict) -> list[dict]:
    """由图表化微观层数据触发的战术（样本 ≥5 场才触发）。"""
    out: list[dict] = []
    if chart.get("sample_matches", 0) < 5:
        return out
    n = chart["sample_matches"]

    def sd(serve: str, side: str, key: str):
        return _get(chart, "serve_direction", serve, side, key)

    # 二发落点倾向 → 接发布局
    for side, label in (("deuce", "平分区"), ("ad", "占先区")):
        w = sd("second", side, "wide_pct")
        t = sd("second", side, "t_pct")
        if w is not None and w >= 60:
            out.append({
                "title": f"接二发 {label}：他 {w}% 发外角",
                "evidence": f"图表化 {n} 场二发落点分布（外角 {w}% / 追身 {sd('second', side, 'body_pct')}% / T {t}%）",
                "detail": "接发站位向外侧多让一步、正手侧身准备打外角来球的反斜线，"
                          "迫使他改变落点时二发质量通常先下降。",
            })
            break
        if t is not None and t >= 60:
            out.append({
                "title": f"接二发 {label}：他 {t}% 发 T（追你的正手/中路）",
                "evidence": f"图表化 {n} 场二发落点（T {t}% / 外角 {w}%）",
                "detail": "站位略靠近中线，接 T 发球后优先打斜线深区压制其上网/第三拍。",
            })
            break

    rally = chart.get("rally") or {}
    short = rally.get("0_3") or {}
    long = rally.get("10p") or {}
    if short.get("win_pct") is not None and long.get("win_pct") is not None:
        if short["win_pct"] >= 55 and long["win_pct"] <= 45:
            out.append({
                "title": "他是'前三拍'型选手——把比赛拖长",
                "evidence": f"0-3 拍胜率 {short['win_pct']}% vs 10+ 拍胜率 {long['win_pct']}%（图表化 {n} 场）",
                "detail": "接发以回深为主不求制胜，发球后第三拍保持过网高度与深度，"
                          "主动把分打到 5 拍以后——他的长回合胜率明显掉档。",
            })
        elif long["win_pct"] >= 55 and short["win_pct"] <= 50:
            out.append({
                "title": "他是相持型选手——前三拍就要下杀手",
                "evidence": f"0-3 拍胜率 {short['win_pct']}% vs 10+ 拍胜率 {long['win_pct']}%（图表化 {n} 场）",
                "detail": "发球+第一拍抢攻组合要敢用：他的稳定性建立在长回合里，"
                          "前三拍建立优势后坚决上网或变线终结。",
            })

    wings = chart.get("wings") or {}
    if wings.get("ue_share_fh_pct") is not None and wings["ue_share_fh_pct"] >= 65:
        out.append({
            "title": "他的 UE 大头在正手（诱攻正手）",
            "evidence": f"非受迫性失误 {wings['ue_share_fh_pct']}% 来自正手（图表化 {n} 场）",
            "detail": "把球权'送'给他的正手（深区+上旋），诱他在移动中发力；"
                      "他的正手 UE 率显著高于反手。",
        })
    net = chart.get("net") or {}
    if net.get("net_freq_pct") is not None and net["net_freq_pct"] >= 25 \
            and net.get("net_win_pct", 0) >= 65:
        out.append({
            "title": "网前型打法：穿越球与挑高球要提前练",
            "evidence": f"网前频率 {net['net_freq_pct']}%、网前得分率 {net['net_win_pct']}%（图表化 {n} 场）",
            "detail": "多用低而深的穿越（两条线都要有）+ 关键分挑高球；"
                      "他的网前效率很高，防守性挑高球至少能打断他的上网节奏。",
        })
    return out


# ---------------------------------------------------------------------------
# 签表导航："下一轮对手"工作流
# ---------------------------------------------------------------------------

# 淘汰赛轮次从早到晚（数据集中 round 的取值）
_ROUND_ORDER = ["R128", "R64", "R32", "R16", "QF", "SF", "F"]
_ROUND_NEXT = dict(zip(_ROUND_ORDER, _ROUND_ORDER[1:]))


def tournament_draw(conn: sqlite3.Connection, tourney_id: str, tour: str) -> dict:
    """一届赛事的签表状态：各轮已完成比赛 + 仍存活球员。"""
    rows = conn.execute(
        """
        SELECT tourney_date, "round", winner_id, winner_name, loser_id, loser_name,
               score, surface, tourney_level, tourney_name, completed, wo
        FROM matches WHERE tourney_id = ? AND tour = ? ORDER BY tourney_date, match_id
        """,
        (tourney_id, tour),
    ).fetchall()
    if not rows:
        raise KeyError(f"tournament {tourney_id} not found in {tour}")

    info = {
        "tourney_id": tourney_id,
        "name": rows[0]["tourney_name"],
        "surface": rows[0]["surface"],
        "level": rows[0]["tourney_level"],
        "tour": tour,
    }
    rounds: dict[str, list] = {}
    for r in rows:
        rounds.setdefault(r["round"], []).append({
            "winner_id": r["winner_id"], "winner": r["winner_name"],
            "loser_id": r["loser_id"], "loser": r["loser_name"],
            "score": r["score"], "date": r["tourney_date"],
        })
    ko_rounds = [rd for rd in _ROUND_ORDER if rd in rounds]
    has_final = "F" in rounds
    losses: dict[int, int] = {}
    wins: dict[int, int] = {}
    name_by_id: dict[int, str] = {}
    for rd, ms in rounds.items():
        for m in ms:
            if m["winner_id"]:
                wins[m["winner_id"]] = wins.get(m["winner_id"], 0) + 1
                name_by_id[m["winner_id"]] = m["winner"]
            if m["loser_id"]:
                losses[m["loser_id"]] = losses.get(m["loser_id"], 0) + 1
                name_by_id[m["loser_id"]] = m["loser"]
    if has_final:
        # 已完赛：冠军即最后存活者
        alive = [m["winner_id"] for m in rounds["F"] if m["winner_id"]]
    else:
        alive = [pid for pid in wins if losses.get(pid, 0) == 0]
    # 带上当前排名/Elo 便于排序展示
    alive_info = []
    for pid in alive:
        p = conn.execute(
            "SELECT r.rank FROM rankings r WHERE r.player_id=? AND r.tour=? "
            "AND r.ranking_date=(SELECT MAX(ranking_date) FROM rankings WHERE tour=?)",
            (pid, tour, tour),
        ).fetchone()
        e = conn.execute(
            "SELECT elo_overall FROM elo WHERE player_id=? AND tour=?", (pid, tour)
        ).fetchone()
        alive_info.append({
            "player_id": pid, "name": name_by_id.get(pid, str(pid)),
            "rank": p["rank"] if p else None,
            "elo": round(e["elo_overall"]) if e and e["elo_overall"] else None,
        })
    alive_info.sort(key=lambda x: (x["rank"] is None, x["rank"] or 9999))
    return {
        "info": info,
        "rounds": {rd: rounds[rd] for rd in _ROUND_ORDER if rd in rounds},
        "other_rounds": sorted(set(rounds) - set(_ROUND_ORDER)),
        "completed": has_final,
        "alive": alive_info,
        "is_ko": bool(ko_rounds),
    }


def my_draw_path(conn: sqlite3.Connection, tourney_id: str, tour: str,
                 player_id: int) -> dict:
    """我方球员在该赛事的路径 + 下一轮潜在对手。"""
    draw = tournament_draw(conn, tourney_id, tour)
    my_rounds = {}
    for rd, ms in draw["rounds"].items():
        for m in ms:
            if m["winner_id"] == player_id or m["loser_id"] == player_id:
                my_rounds[rd] = m | {"won": m["winner_id"] == player_id, "round": rd}
    if not my_rounds:
        return {"draw": draw, "status": "not_in_draw"}
    played = [rd for rd in _ROUND_ORDER if rd in my_rounds]
    my_matches = [my_rounds[rd] for rd in played]
    last = played[-1] if played else None
    if draw["completed"]:
        return {"draw": draw, "status": "completed", "my_matches": my_matches,
                "last_round": last, "next_round": None,
                "next_opponent_candidates": []}
    eliminated = bool(my_rounds.get(last, {}).get("won") is False)
    candidates = [p for p in draw["alive"] if p["player_id"] != player_id]
    return {
        "draw": draw,
        "status": "eliminated" if eliminated else "alive",
        "my_matches": my_matches,
        "last_round": last,
        "next_round": _ROUND_NEXT.get(last),
        # 无签表位置数据时无法精确到同半区，给出全部存活候选并按排名排序
        "next_opponent_candidates": candidates,
        "candidates_note": "签表半区信息不在记分数据中，候选为当前轮全部存活球员",
    }
