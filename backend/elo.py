"""Elo ratings, replayed from a board's full match history on every request.

Each side's strength is its players' average rating plus the rating its club had when the match was
played times the board's club weight at the time (both stored on the match, see seasons.py; the
weight defaults to 0.5, half the club). The rating change
is K × (result − expected) × a multiplier that rewards wide margins and upsets; every player on a
side gets the same change. The frontend mirrors this in frontend/src/lib/elo.ts: keep them in sync.
"""

from db import Database

INITIAL_ELO = 1000
DEFAULT_CLUB_ELO = 500  # clubs that are not in the season's list (custom names)


def expected_score(a: float, b: float) -> float:
    return 1.0 / (1.0 + 10 ** ((b - a) / 400.0))


def margin_multiplier(
    winner_elo: float,
    loser_elo: float,
    margin: int,
    m_max: float = 3.0,
    power: float = 1.5,
    upset_scale: float = 0.5,
) -> float:
    """Convex reward for the goal margin, times a bonus when the weaker side wins."""
    margin = abs(margin)
    margin_factor = 1.0 + (m_max - 1.0) * ((margin / 15.0) ** power)
    upset_bonus = 1.0
    if winner_elo < loser_elo:
        upset_bonus = 1.0 + upset_scale * ((loser_elo - winner_elo) / 400.0) * (margin / 15.0)
    return margin_factor * upset_bonus


def compute_ratings(player_ids: list[int], matches: list[dict], k_factor: int) -> dict[int, int]:
    """{player_id: elo} after replaying `matches` (oldest first; teams are lists of player ids)."""
    ratings: dict[int, float] = {pid: float(INITIAL_ELO) for pid in player_ids}

    def side_strength(ids: list[int], club_elo: int, club_weight: float) -> float:
        return sum(ratings[i] for i in ids) / len(ids) + club_elo * club_weight

    for m in matches:
        team_a = [pid for pid in m["team_a"] or [] if pid in ratings]
        team_b = [pid for pid in m["team_b"] or [] if pid in ratings]
        if not team_a or not team_b:
            continue

        strength_a = side_strength(team_a, m["club_a_elo"], m["club_weight"])
        strength_b = side_strength(team_b, m["club_b_elo"], m["club_weight"])
        exp_a = expected_score(strength_a, strength_b)

        score_a, score_b = int(m["score_a"] or 0), int(m["score_b"] or 0)
        if score_a > score_b:
            result_a, multiplier = 1.0, margin_multiplier(strength_a, strength_b, score_a - score_b)
        elif score_b > score_a:
            result_a, multiplier = 0.0, margin_multiplier(strength_b, strength_a, score_b - score_a)
        else:
            result_a, multiplier = 0.5, 1.0

        delta_a = k_factor * (result_a - exp_a) * multiplier
        delta_b = k_factor * ((1.0 - result_a) - (1.0 - exp_a)) * multiplier
        for pid in team_a:
            ratings[pid] += delta_a
        for pid in team_b:
            ratings[pid] += delta_b

    return {pid: int(round(r)) for pid, r in ratings.items()}


def board_ratings(db: Database, board_id: int, k_factor: int) -> dict[int, int]:
    """Ratings for every player of a board, archived ones included (they still shaped history)."""
    players = db.fetch_all("SELECT id FROM players WHERE board_id = %s ORDER BY id", (board_id,))
    matches = db.fetch_all(
        """
        SELECT m.club_a_elo, m.club_b_elo, m.club_weight, m.score_a, m.score_b,
               ARRAY_AGG(mp.player_id ORDER BY mp.slot) FILTER (WHERE mp.side = 'A') AS team_a,
               ARRAY_AGG(mp.player_id ORDER BY mp.slot) FILTER (WHERE mp.side = 'B') AS team_b
        FROM matches m
        LEFT JOIN match_players mp ON mp.match_id = m.id
        WHERE m.board_id = %s
        GROUP BY m.id
        ORDER BY m.time, m.id
        """,
        (board_id,),
    )
    return compute_ratings([p["id"] for p in players], matches, k_factor)
