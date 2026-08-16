"""Tactical pattern mining over enriched rallies.

Every pattern is emitted as an evidence-backed PatternCard: enough support
(n occurrences), a win-rate or usage-rate signal, the rally ids that back
it, and a takeaway the user can apply to their own game.

Patterns mined here:
    - serve direction (T / body / wide) effectiveness per (server, side)
    - serve +1: serve direction -> server's next shot direction -> outcome
    - shot-direction n-grams per player (most repeated sequences)
    - rally-length buckets vs point winner
    - volley / front-court aggression effectiveness
"""

from __future__ import annotations

from collections import Counter, defaultdict

from app.domain.events import MatchStats, PatternCard, PatternCategory, Rally, Shot
from app.domain.events import CourtSide, ShotDirection
from app.services.analysis import court_geometry as cg

MIN_SUPPORT_DEFAULT = 3

# Service box thirds (screen x) used to label serve direction.
_WIDE_LO = cg.SINGLES_MARGIN
_T_HI = cg.COURT_WIDTH - cg.SINGLES_MARGIN


def serve_direction(shot: Shot, serve_side: CourtSide) -> str | None:
    """Label a serve as wide / body / T relative to its target service box.

    The deuce box spans x [1.37, 5.485] (T at the center line, wide at the
    sideline); the ad box mirrors it. Serves landing outside the box are
    not labelled (faults / tracking noise).
    """
    if not shot.is_serve or shot.landing_position is None:
        return None
    x, y = shot.landing_position[0], shot.landing_position[1]
    if not (cg.SERVICE_LINE_NEAR - 0.5 <= y <= cg.SERVICE_LINE_FAR + 0.5):
        return None
    if serve_side == CourtSide.DEUCE:
        lo, hi = cg.SINGLES_MARGIN, cg.CENTER_X
        t_frac = (x - lo) / (hi - lo)  # 1.0 at the center line
    else:
        lo, hi = cg.CENTER_X, cg.COURT_WIDTH - cg.SINGLES_MARGIN
        t_frac = (hi - x) / (hi - lo)
    if not (-0.2 <= t_frac <= 1.2):
        return None
    if t_frac > 0.67:
        return "t"
    if t_frac < 0.33:
        return "wide"
    return "body"


def _dir_label(d: ShotDirection | None) -> str:
    return d.value if d else "?"


def mine_serve_patterns(
    rallies: list[Rally], min_support: int = MIN_SUPPORT_DEFAULT
) -> list[PatternCard]:
    """Serve direction effectiveness: usage + win rate, per server & side."""
    buckets: dict[tuple[int, str, str], list[Rally]] = defaultdict(list)
    for r in rallies:
        if not r.shots:
            continue
        sd = serve_direction(r.shots[0], r.serve_side)
        if sd is None:
            continue
        buckets[(r.server, r.serve_side.value, sd)].append(r)

    cards: list[PatternCard] = []
    for (server, side, sd), rs in sorted(buckets.items(), key=lambda kv: -len(kv[1])):
        n = len(rs)
        if n < min_support:
            continue
        wins = sum(1 for r in rs if r.winner == server)
        win_rate = wins / n
        usage_total = sum(
            len(b)
            for (s2, side2, sd2), b in buckets.items()
            if s2 == server and side2 == side
        )
        usage = n / usage_total if usage_total else 0.0
        cards.append(
            PatternCard(
                code=f"serve_{server}_{side}_{sd}",
                category=PatternCategory.SERVE,
                title=f"Player {server} {side}-side {sd.upper()} serve",
                description=(
                    f"Uses this serve for {usage:.0%} of {side}-side points "
                    f"({n} points); wins {wins}/{n} ({win_rate:.0%}) behind it."
                ),
                player_id=server,
                support=n,
                confidence=round(min(0.5 + win_rate / 2, 0.95) * min(n / 5, 1.0), 2),
                evidence_rally_ids=[r.id for r in rs],
                takeaway=(
                    f"When {sd} serves land, the return is pulled "
                    + ("wide, opening the court for the next shot." if sd == "wide" else
                       "into the body, jamming the returner." if sd == "body" else
                       "to the middle, keeping the court closed.")
                ),
            )
        )
    return cards


def mine_serve_plus_one(
    rallies: list[Rally], min_support: int = MIN_SUPPORT_DEFAULT
) -> list[PatternCard]:
    """serve direction -> server's 3rd-ball direction -> point outcome."""
    buckets: dict[tuple[int, str, str, str], list[Rally]] = defaultdict(list)
    for r in rallies:
        if len(r.shots) < 3:
            continue
        sd = serve_direction(r.shots[0], r.serve_side)
        if sd is None:
            continue
        # the server's next shot after the return (shot index 2)
        plus_one = r.shots[2]
        if plus_one.player_id != r.server:
            continue
        buckets[(r.server, r.serve_side.value, sd, _dir_label(plus_one.direction))].append(r)

    cards = []
    for (server, side, sd, nxt), rs in sorted(buckets.items(), key=lambda kv: -len(kv[1])):
        n = len(rs)
        if n < min_support:
            continue
        wins = sum(1 for r in rs if r.winner == server)
        win_rate = wins / n
        cards.append(
            PatternCard(
                code=f"sp1_{server}_{side}_{sd}_{nxt}",
                category=PatternCategory.SERVE_PLUS_ONE,
                title=f"Player {server}: {sd} serve -> +1 {nxt}",
                description=(
                    f"After a {sd} serve from the {side} side, player {server} "
                    f"plays the next ball {nxt} on {n} points and wins "
                    f"{wins}/{n} ({win_rate:.0%})."
                ),
                player_id=server,
                support=n,
                confidence=round(min(0.45 + win_rate / 2, 0.95) * min(n / 4, 1.0), 2),
                evidence_rally_ids=[r.id for r in rs],
                takeaway=(
                    "Serve-plus-one is where points are designed, not random: "
                    "practise this exact two-ball combination rather than isolated serves."
                ),
            )
        )
    return cards


def mine_direction_ngrams(
    rallies: list[Rally],
    n: int = 2,
    min_support: int = MIN_SUPPORT_DEFAULT,
    top_k: int = 3,
) -> list[PatternCard]:
    """Most repeated consecutive shot-direction sequences per player."""
    seqs: dict[int, Counter] = defaultdict(Counter)
    evidence: dict[int, dict[tuple[str, ...], list[int]]] = defaultdict(lambda: defaultdict(list))
    for r in rallies:
        dirs = [_dir_label(s.direction) for s in r.shots]
        for i in range(len(dirs) - n + 1):
            pid = r.shots[i].player_id  # attribute the n-gram to its starter
            gram = tuple(dirs[i : i + n])
            seqs[pid][gram] += 1
            evidence[pid][gram].append(r.id)

    cards = []
    for pid, counter in seqs.items():
        for gram, count in counter.most_common(top_k):
            if count < min_support:
                continue
            arrows = " -> ".join(gram)
            cards.append(
                PatternCard(
                    code=f"ngram_{pid}_{'_'.join(gram)}",
                    category=PatternCategory.DIRECTION,
                    title=f"Player {pid} repeats: {arrows}",
                    description=(
                        f"Player {pid} plays '{arrows}' {count} times across "
                        f"analysed rallies -- a default rally pattern you can anticipate."
                    ),
                    player_id=pid,
                    support=count,
                    confidence=round(min(0.4 + count / 10, 0.9), 2),
                    evidence_rally_ids=evidence[pid][gram],
                    takeaway=(
                        "Recognise the first arrow and pre-position for the second: "
                        "pattern recognition beats raw speed at club level."
                    ),
                )
            )
    return cards


def mine_rally_length_outcome(
    rallies: list[Rally], min_support: int = MIN_SUPPORT_DEFAULT
) -> list[PatternCard]:
    """Which player owns short vs long rallies."""
    buckets = {"short (<=4)": lambda k: k <= 4, "medium (5-8)": lambda k: 5 <= k <= 8, "long (9+)": lambda k: k >= 9}
    cards = []
    for label, pred in buckets.items():
        rs = [r for r in rallies if r.winner is not None and pred(len(r.shots))]
        if len(rs) < min_support:
            continue
        wins: dict[int, int] = Counter(r.winner for r in rs)
        for pid, w in wins.most_common(1):
            share = w / len(rs)
            cards.append(
                PatternCard(
                    code=f"rallylen_{label.replace(' ', '').replace('(', '').replace(')', '')}_{pid}",
                    category=PatternCategory.RALLY,
                    title=f"Player {pid} owns {label} rallies",
                    description=(
                        f"Player {pid} wins {w}/{len(rs)} ({share:.0%}) of points with "
                        f"{label} shots."
                    ),
                    player_id=pid,
                    support=len(rs),
                    confidence=round(min(0.4 + share / 2, 0.9) * min(len(rs) / 6, 1.0), 2),
                    evidence_rally_ids=[r.id for r in rs if r.winner == pid],
                    takeaway=(
                        f"Steer point length toward this zone: "
                        + ("first-strike tennis -- take the ball early." if pred(2) else
                           "build the first three shots with intent." if pred(6) else
                           "extend rallies, make the extra ball, stay neutral.")
                    ),
                )
            )
    return cards


def mine_front_court(
    rallies: list[Rally], min_support: int = MIN_SUPPORT_DEFAULT
) -> list[PatternCard]:
    """Net aggression: points containing a volley by a player and their win rate."""
    by_player: dict[int, list[Rally]] = defaultdict(list)
    for r in rallies:
        pids = {s.player_id for s in r.shots if s.is_volley}
        for pid in pids:
            by_player[pid].append(r)
    cards = []
    for pid, rs in sorted(by_player.items()):
        if len(rs) < min_support:
            continue
        wins = sum(1 for r in rs if r.winner == pid)
        win_rate = wins / len(rs)
        cards.append(
            PatternCard(
                code=f"net_{pid}",
                category=PatternCategory.POSITION,
                title=f"Player {pid} at the net: {win_rate:.0%} win rate",
                description=(
                    f"Comes forward on {len(rs)} points and converts {wins}/{len(rs)}."
                ),
                player_id=pid,
                support=len(rs),
                confidence=round(min(0.4 + win_rate / 2, 0.9) * min(len(rs) / 4, 1.0), 2),
                evidence_rally_ids=[r.id for r in rs],
                takeaway=(
                    "Net points end fast either way: pick approaches that land deep "
                    "and split-step before committing forward."
                ),
            )
        )
    return cards


def mine_all(rallies: list[Rally], min_support: int = MIN_SUPPORT_DEFAULT) -> list[PatternCard]:
    cards: list[PatternCard] = []
    cards += mine_serve_patterns(rallies, min_support)
    cards += mine_serve_plus_one(rallies, min_support)
    cards += mine_direction_ngrams(rallies, 2, min_support)
    cards += mine_rally_length_outcome(rallies, min_support)
    cards += mine_front_court(rallies, min_support)
    cards.sort(key=lambda c: (c.support, c.confidence), reverse=True)
    return cards


def compute_stats(rallies: list[Rally]) -> MatchStats:
    stats = MatchStats()
    stats.points = len(rallies)
    stats.points_won = {1: 0, 2: 0}
    stats.shots = {1: 0, 2: 0}
    stats.volleys = {1: 0, 2: 0}
    stats.direction_counts = {1: {"cross": 0, "line": 0, "middle": 0}, 2: {"cross": 0, "line": 0, "middle": 0}}
    lengths = [len(r.shots) for r in rallies if r.shots]
    stats.avg_rally_length = round(sum(lengths) / len(lengths), 2) if lengths else 0.0
    stats.longest_rally = max(lengths, default=0)
    for r in rallies:
        if r.winner in (1, 2):
            stats.points_won[r.winner] += 1
        for s in r.shots:
            stats.shots[s.player_id] = stats.shots.get(s.player_id, 0) + 1
            if s.is_volley:
                stats.volleys[s.player_id] = stats.volleys.get(s.player_id, 0) + 1
            if s.direction and s.player_id in stats.direction_counts:
                stats.direction_counts[s.player_id][s.direction.value] += 1
    return stats
