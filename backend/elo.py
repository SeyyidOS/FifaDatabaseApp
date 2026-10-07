"""Elo ratings, replayed from a board's full match history on every request.

Each side's strength is its players' average rating plus half its club's rating. The rating change
is K × (result − expected) × a multiplier that rewards wide margins and upsets; every player on a
side gets the same change. The frontend mirrors this in frontend/src/lib/elo.ts: keep them in sync.
"""

from db import Database

INITIAL_ELO = 1000
DEFAULT_CLUB_ELO = 500  # clubs that are not in the clubs table (custom names)


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


def compute_ratings(player_ids: list[int], clubs: list[dict], matches: list[dict], k_factor: int) -> dict[int, int]:
    """{player_id: elo} after replaying `matches` (oldest first; teams are lists of player ids)."""
    club_elo = {c["name"]: c["elo"] if c.get("elo") is not None else DEFAULT_CLUB_ELO for c in clubs}
    ratings: dict[int, float] = {pid: float(INITIAL_ELO) for pid in player_ids}

    def side_strength(ids: list[int], club: str) -> float:
        return sum(ratings[i] for i in ids) / len(ids) + club_elo.get(club, DEFAULT_CLUB_ELO) / 2

    for m in matches:
        team_a = [pid for pid in m["team_a"] or [] if pid in ratings]
        team_b = [pid for pid in m["team_b"] or [] if pid in ratings]
        if not team_a or not team_b:
            continue

        strength_a = side_strength(team_a, m["club_a"])
        strength_b = side_strength(team_b, m["club_b"])
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
    clubs = db.fetch_all("SELECT name, elo FROM clubs")
    matches = db.fetch_all(
        """
        SELECT m.club_a, m.club_b, m.score_a, m.score_b,
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
    return compute_ratings([p["id"] for p in players], clubs, matches, k_factor)
