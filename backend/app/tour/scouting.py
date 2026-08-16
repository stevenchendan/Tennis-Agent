"""球探报告生成器：给定对手（+场地/赛事/我方球员），产出职业级赛前报告。

报告 JSON 由确定性规则组装（保发/破发/统治率/百分位/关键分/负荷/H2H/
场馆史/风格标签/战术建议），LLM 只作为可选的"教练视角"叙述层叠加其上，
与视频分析报告同款降级策略：无 key 也有完整可用报告。
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

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
        "data_window": {
            "from": date_from, "to": data_to,
            "synced_at": conn.execute(
                "SELECT value FROM meta WHERE key='synced_at'"
            ).fetchone()["value"],
        },
    }
    return report
