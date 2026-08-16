"""SQLite 数据库层：原始 CSV → 规范化的 players/matches/rankings/elo。

matches 表在入库时就把比分串解析成结构化列（盘/局/抢七/决胜盘/是否完整
完赛），指标引擎只做纯计算，不再碰字符串。Elo 在构建时从 2000 年起
全量重放（整体 + 分场地），属于我们自己的高阶评分，不依赖官方排名。
"""

from __future__ import annotations

import datetime as dt
import logging
import re
import sqlite3
import threading
from pathlib import Path

import pandas as pd

log = logging.getLogger(__name__)

DB_NAME = "tour.db"

_local = threading.local()


# ---------------------------------------------------------------------------
# 比分解析
# ---------------------------------------------------------------------------

_SET_RE = re.compile(r"^(\d{1,2})-(\d{1,2})(?:\((\d{1,2})[^)]*\))?$")
_SPECIAL = ("w/o", "walkover", "def", "def.", "unk", "n/p", "canc", "abandoned")


def parse_score(score: str | None, best_of: int | None = None) -> dict:
    """解析比分串 → 结构化字段（胜者视角）。容错 ret / w/o / 缺失 / 快4制。"""
    out = {
        "sets_w": 0, "sets_l": 0, "games_w": 0, "games_l": 0,
        "tb_w": 0, "tb_l": 0, "deciding": 0, "deciding_w": 0,
        "completed": 0, "ret": 0, "wo": 0, "no_score": 0,
    }
    if not score or not isinstance(score, str) or not score.strip():
        out["no_score"] = 1
        return out
    s = score.strip().lower()
    if s in _SPECIAL or s.startswith(("w/o", "walkover")):
        out["wo"] = 1
        return out

    retired = "ret" in s
    parsed: list[tuple[int, int, bool]] = []
    for token in s.split():
        if token in ("ret", "ret.", "abandoned", "susp", "comp.", "played", "def."):
            continue
        m = _SET_RE.match(token)
        if m:
            parsed.append((int(m.group(1)), int(m.group(2)), m.group(3) is not None))

    if not parsed:
        out["no_score"] = 1
        return out

    for a, b, tb in parsed:
        out["games_w"] += a
        out["games_l"] += b
        if a > b:
            out["sets_w"] += 1
            out["tb_w"] += int(tb)
        else:
            out["sets_l"] += 1
            out["tb_l"] += int(tb)

    need = 3 if best_of == 5 else 2
    finished = (out["sets_w"] == need or out["sets_l"] == need) and not retired
    out["completed"] = int(finished)
    out["ret"] = int(retired)
    # 数据集里 winner 恒为比赛胜者；完整完赛且被拖入最后一盘 = 决胜盘。
    if finished:
        out["deciding"] = int(out["sets_l"] == need - 1)
        out["deciding_w"] = out["deciding"]
    return out


# ---------------------------------------------------------------------------
# Elo 重放
# ---------------------------------------------------------------------------

_ELO_START = 1500.0
# 按赛事级别的 K 值：大满贯权重最高，ITF/挑战赛最低。
_ELO_K = {"G": 48.0, "M": 40.0, "PM": 40.0, "P": 36.0, "A": 32.0, "W": 36.0,
          "C": 24.0, "I": 20.0, "Q": 16.0, "D": 32.0, "O": 36.0, "F": 20.0}
_ELO_SINCE = 2000
_SURFACES = ("Clay", "Hard", "Grass")


def _replay_elo(all_matches: pd.DataFrame, tour: str) -> list[tuple]:
    """从 2000 年起重放全部比赛，返回每名球员 整体/分场地 的 Elo 快照行。

    all_matches 需已附加解析出的 sets_w / sets_l 列。
    """
    m = all_matches[[
        "tourney_date", "tourney_level", "surface", "winner_id", "loser_id",
        "sets_w", "sets_l",
    ]].copy()
    years = pd.to_numeric(m["tourney_date"].str[:4], errors="coerce")
    m = m[years >= _ELO_SINCE]
    k = m["tourney_level"].map(_ELO_K).fillna(28.0).astype(float)
    # 净胜两盘以上的"干脆胜利"加成 20%；鏖战到决胜盘/抢七不加成。
    margin = (m["sets_w"] - m["sets_l"]).abs() >= 2
    m["kfactor"] = (k * (1.0 + 0.2 * margin.astype(float))).to_numpy()

    ratings: dict[int, list[float]] = {}  # pid -> [overall, clay, hard, grass]
    counts: dict[int, list[int]] = {}

    def _ensure(pid: int) -> None:
        if pid not in ratings:
            ratings[pid] = [_ELO_START] * 4
            counts[pid] = [0] * 4

    for t in m.itertuples(index=False, name=None):
        (tourney_date, tourney_level, surface, winner_id, loser_id,
         sets_w, sets_l, kfactor) = (t[0], t[1], t[2], t[3], t[4], t[5], t[6], t[7])
        if pd.isna(winner_id) or pd.isna(loser_id):
            continue
        w, l = int(winner_id), int(loser_id)
        _ensure(w)
        _ensure(l)
        rw, rl = ratings[w][0], ratings[l][0]
        exp_w = 1.0 / (1.0 + 10 ** ((rl - rw) / 400.0))
        delta = kfactor * (1.0 - exp_w)
        ratings[w][0] += delta
        ratings[l][0] -= delta
        counts[w][0] += 1
        counts[l][0] += 1
        if surface in _SURFACES:
            si = _SURFACES.index(surface) + 1
            rw, rl = ratings[w][si], ratings[l][si]
            exp_w = 1.0 / (1.0 + 10 ** ((rl - rw) / 400.0))
            d = kfactor * (1.0 - exp_w)
            ratings[w][si] += d
            ratings[l][si] -= d
            counts[w][si] += 1
            counts[l][si] += 1

    rows = []
    for pid, r in ratings.items():
        c = counts[pid]
        rows.append((pid, tour, r[0], r[1], r[2], r[3], c[0], c[1], c[2], c[3]))
    return rows


# ---------------------------------------------------------------------------
# 建库
# ---------------------------------------------------------------------------

SCHEMA = """
CREATE TABLE IF NOT EXISTS players (
    player_id INTEGER NOT NULL,
    tour TEXT NOT NULL,
    name TEXT NOT NULL,
    first_name TEXT, last_name TEXT,
    hand TEXT, dob TEXT, ioc TEXT, height INTEGER, wikidata_id TEXT,
    PRIMARY KEY (player_id, tour)
);
CREATE TABLE IF NOT EXISTS matches (
    match_id TEXT PRIMARY KEY,
    tour TEXT NOT NULL, tier TEXT NOT NULL,
    tourney_id TEXT, tourney_name TEXT, surface TEXT, tourney_level TEXT,
    tourney_date TEXT, round TEXT, best_of INTEGER, minutes INTEGER,
    winner_id INTEGER, loser_id INTEGER, winner_name TEXT, loser_name TEXT,
    score TEXT, completed INTEGER, ret INTEGER, wo INTEGER, no_score INTEGER,
    sets_w INTEGER, sets_l INTEGER, games_w INTEGER, games_l INTEGER,
    tb_w INTEGER, tb_l INTEGER, deciding INTEGER, deciding_w INTEGER,
    w_svpt INTEGER, w_1stIn INTEGER, w_1stWon INTEGER, w_2ndWon INTEGER,
    w_SvGms INTEGER, w_bpSaved INTEGER, w_bpFaced INTEGER,
    w_ace INTEGER, w_df INTEGER,
    l_svpt INTEGER, l_1stIn INTEGER, l_1stWon INTEGER, l_2ndWon INTEGER,
    l_SvGms INTEGER, l_bpSaved INTEGER, l_bpFaced INTEGER,
    l_ace INTEGER, l_df INTEGER,
    winner_rank INTEGER, winner_rank_points INTEGER,
    loser_rank INTEGER, loser_rank_points INTEGER
);
CREATE TABLE IF NOT EXISTS rankings (
    tour TEXT, ranking_date TEXT, player_id INTEGER, rank INTEGER, points INTEGER,
    PRIMARY KEY (tour, ranking_date, player_id)
);
CREATE TABLE IF NOT EXISTS elo (
    player_id INTEGER, tour TEXT,
    elo_overall REAL, elo_clay REAL, elo_hard REAL, elo_grass REAL,
    elo_n INTEGER, elo_n_clay INTEGER, elo_n_hard INTEGER, elo_n_grass INTEGER,
    PRIMARY KEY (player_id, tour)
);
CREATE INDEX IF NOT EXISTS idx_matches_winner ON matches(winner_id);
CREATE INDEX IF NOT EXISTS idx_matches_loser ON matches(loser_id);
CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(tourney_date);
CREATE INDEX IF NOT EXISTS idx_matches_tour_date ON matches(tour, tourney_date, completed);
CREATE INDEX IF NOT EXISTS idx_matches_tourney ON matches(tourney_id);
CREATE INDEX IF NOT EXISTS idx_rankings_player ON rankings(player_id);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
"""

_INT_COLS = {
    "draw_size", "best_of", "match_num", "minutes", "winner_id", "loser_id",
    "winner_ht", "loser_ht", "winner_rank", "winner_rank_points",
    "loser_rank", "loser_rank_points",
    "w_svpt", "w_1stIn", "w_1stWon", "w_2ndWon", "w_SvGms", "w_bpSaved",
    "w_bpFaced", "w_ace", "w_df", "l_svpt", "l_1stIn", "l_1stWon",
    "l_2ndWon", "l_SvGms", "l_bpSaved", "l_bpFaced", "l_ace", "l_df",
}

# matches 表插入列顺序（与 SCHEMA 中 matches 一致）
_MATCH_COLS = (
    "match_id", "tour", "tier", "tourney_id", "tourney_name", "surface",
    "tourney_level", "tourney_date", "round", "best_of", "minutes",
    "winner_id", "loser_id", "winner_name", "loser_name", "score",
    "completed", "ret", "wo", "no_score",
    "sets_w", "sets_l", "games_w", "games_l", "tb_w", "tb_l",
    "deciding", "deciding_w",
    "w_svpt", "w_1stIn", "w_1stWon", "w_2ndWon", "w_SvGms", "w_bpSaved",
    "w_bpFaced", "w_ace", "w_df",
    "l_svpt", "l_1stIn", "l_1stWon", "l_2ndWon", "l_SvGms", "l_bpSaved",
    "l_bpFaced", "l_ace", "l_df",
    "winner_rank", "winner_rank_points", "loser_rank", "loser_rank_points",
)

def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def get_conn(db_path: Path) -> sqlite3.Connection:
    """线程复用的连接（FastAPI 线程池下安全；SQLite 读并发无压力）。"""
    key = f"conn_{db_path.resolve()}"
    conn = getattr(_local, key, None)
    if conn is None:
        conn = connect(db_path)
        setattr(_local, key, conn)
    return conn


def _read_csv(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str, keep_default_na=False, na_values=[""])
    for col in df.columns:
        if col in _INT_COLS:
            df[col] = pd.to_numeric(df[col], errors="coerce").astype("Int64")
    return df


def _match_rows(tour: str, tier: str, df: pd.DataFrame) -> list[tuple]:
    """CSV 行 → matches 表行（含比分解析）。"""
    rows = []
    for d in df.to_dict("records"):
        best_of = None if pd.isna(d.get("best_of")) else int(d["best_of"])
        p = parse_score(d.get("score"), best_of)
        rec = {
            "match_id": f"{tour}-{d.get('tourney_id', '')}-{d.get('match_num', '')}",
            "tour": tour, "tier": tier,
            "best_of": best_of,
            **p,
        }
        for col in _MATCH_COLS:
            if col in rec:
                continue
            v = d.get(col)
            if v is None or (not isinstance(v, str) and pd.isna(v)):
                v = None
            elif not isinstance(v, str):
                v = int(v)  # numpy/Int64 整数 → Python int（sqlite 绑定要求）
            rec[col] = v
        rows.append(tuple(rec[c] for c in _MATCH_COLS))
    return rows


def build(db_path: Path, raw_dir: Path) -> dict:
    """全量重建数据库（原始 CSV → SQLite + Elo 重放）。"""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    for stale in (Path(str(db_path) + "-wal"), Path(str(db_path) + "-shm")):
        stale.unlink(missing_ok=True)
    db_path.unlink(missing_ok=True)
    conn = connect(db_path)
    conn.executescript(SCHEMA)

    n_matches = n_players = n_rankings = n_elo = 0

    for tour in ("atp", "wta"):
        players = _read_csv(raw_dir / f"{tour}__{tour}_players.csv")
        p_rows = [
            (
                int(r["player_id"]), tour,
                f"{r['name_first']} {r['name_last']}".strip(),
                r.get("name_first"), r.get("name_last"),
                r.get("hand") if r.get("hand") in ("R", "L") else "U",
                None if pd.isna(r.get("dob")) else str(int(float(r["dob"]))),
                r.get("ioc"),
                None if pd.isna(r.get("height")) else int(r["height"]),
                r.get("wikidata_id"),
            )
            for r in players.to_dict("records")
        ]
        conn.executemany("INSERT OR REPLACE INTO players VALUES (?,?,?,?,?,?,?,?,?,?)", p_rows)
        n_players += len(p_rows)

        match_frames: list[tuple[str, pd.DataFrame]] = []
        for f in sorted(raw_dir.glob(f"{tour}__{tour}_matches_*.csv")):
            tier = "secondary" if ("qual_chall" in f.name or "qual_itf" in f.name) else "main"
            match_frames.append((tier, _read_csv(f)))
        all_matches = pd.concat([df for _, df in match_frames], ignore_index=True)
        # 附加解析后的盘数（Elo 重放的净胜盘加成要用）。
        parsed = [
            parse_score(
                r.get("score"),
                None if pd.isna(r.get("best_of")) else int(r["best_of"]),
            )
            for r in all_matches.to_dict("records")
        ]
        all_matches["sets_w"] = [p["sets_w"] for p in parsed]
        all_matches["sets_l"] = [p["sets_l"] for p in parsed]
        for tier, df in match_frames:
            conn.executemany(
                "INSERT OR REPLACE INTO matches VALUES (" + ",".join("?" * len(_MATCH_COLS)) + ")",
                _match_rows(tour, tier, df),
            )
            n_matches += len(df)

        rank_frames = []
        for name in ("rankings_00s", "rankings_10s", "rankings_20s", "rankings_current"):
            p = raw_dir / f"{tour}__{tour}_{name}.csv"
            if p.exists():
                rank_frames.append(_read_csv(p))
        rk_rows = []
        for rk in rank_frames:
            for r in rk.to_dict("records"):
                if not pd.isna(r.get("player")):
                    rk_rows.append((
                        tour, r.get("ranking_date"), int(r["player"]),
                        None if pd.isna(r.get("rank")) else int(r["rank"]),
                        None if pd.isna(r.get("points")) else int(r["points"]),
                    ))
        conn.executemany("INSERT OR REPLACE INTO rankings VALUES (?,?,?,?,?)", rk_rows)
        n_rankings += len(rk_rows)

        if match_frames:
            elo_rows = _replay_elo(all_matches, tour)
            conn.executemany(
                "INSERT OR REPLACE INTO elo VALUES (?,?,?,?,?,?,?,?,?,?)", elo_rows
            )
            n_elo += len(elo_rows)
        log.info("%s: %d matches, elo %d players", tour, len(all_matches), n_elo)

    dates = conn.execute("SELECT MIN(tourney_date), MAX(tourney_date) FROM matches").fetchone()
    conn.execute(
        "INSERT OR REPLACE INTO meta VALUES ('synced_at', ?)",
        (dt.datetime.now().isoformat(timespec="seconds"),),
    )
    if dates and dates[0]:
        conn.execute("INSERT OR REPLACE INTO meta VALUES ('data_from', ?)", (dates[0],))
        conn.execute("INSERT OR REPLACE INTO meta VALUES ('data_to', ?)", (dates[1],))
    conn.commit()
    conn.close()
    return {"matches": n_matches, "players": n_players, "rankings": n_rankings, "elo": n_elo}
