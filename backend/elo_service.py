# elo_service.py
from typing import Dict, List
import math

INITIAL_ELO = 1000


def _clean(s: str) -> str:
    return (
        (s or "")
        .replace("{", "")
        .replace("}", "")
        .replace("(", "")
        .replace(")", "")
        .strip()
        .lower()
    )


def m_upset_bonus(
    winner_elo: float,
    loser_elo: float,
    margin: int,
    M_max: float = 3.0,
    power: float = 1.5,
    upset_scale: float = 0.5,
) -> float:
    """
    Calculates a multiplier based on:
    - Convex margin factor (more reward for bigger wins)
    - Upset bonus (extra points for lower-rated team beating a higher-rated team)
    """
    abs_margin = abs(margin)

    # Step 1: Convex margin multiplier
    margin_factor = 1.0 + (M_max - 1.0) * ((abs_margin / 15.0) ** power)

    # Step 2: Upset bonus
    if winner_elo < loser_elo:
        rating_gap = loser_elo - winner_elo
        upset_bonus = 1.0 + upset_scale * (rating_gap / 400.0) * (abs_margin / 15.0)
    else:
        upset_bonus = 1.0

    # Step 3: Final multiplier
    return margin_factor * upset_bonus


class EloService:
    def __init__(self, db):
        self.db = db

    def _fetch_players(self) -> List[dict]:
        return self.db.execute("SELECT id, name FROM players ORDER BY id ASC;")

    def _fetch_matches(self) -> List[dict]:
        # chronological order for stable ELO evolution
        return self.db.execute("SELECT * FROM matches ORDER BY time ASC;")

    def compute_ratings(self, k_factor: int) -> Dict[int, int]:
        """
        Returns {player_id: elo} after processing all matches using the provided K.
        """
        players = self._fetch_players()
        matches = self._fetch_matches()
        if not players:
            return {}

        name_to_id = {_clean(p["name"]): p["id"] for p in players}
        ratings: Dict[int, float] = {p["id"]: float(INITIAL_ELO) for p in players}

        def team_avg(ids: List[int]) -> float:
            if not ids:
                return float(INITIAL_ELO)
            return sum(ratings.get(pid, INITIAL_ELO) for pid in ids) / len(ids)

        def expected(a: float, b: float) -> float:
            return 1.0 / (1.0 + 10 ** ((b - a) / 400.0))

        for m in matches:
            team_a_names = [
                _clean(x) for x in (m.get("team_a") or "").split(",") if _clean(x)
            ]
            team_b_names = [
                _clean(x) for x in (m.get("team_b") or "").split(",") if _clean(x)
            ]

            team_a_ids = [name_to_id[n] for n in team_a_names if n in name_to_id]
            team_b_ids = [name_to_id[n] for n in team_b_names if n in name_to_id]
            if not team_a_ids or not team_b_ids:
                continue

            avg_a = team_avg(team_a_ids)
            avg_b = team_avg(team_b_ids)

            # Expected scores
            exp_a = expected(avg_a, avg_b)
            exp_b = 1.0 - exp_a

            # Actual scores
            a_score = int(m.get("score_a") or 0)
            b_score = int(m.get("score_b") or 0)
            if a_score > b_score:
                s_a, s_b = 1.0, 0.0
                winner_elo, loser_elo = avg_a, avg_b
                margin = a_score - b_score
            elif b_score > a_score:
                s_a, s_b = 0.0, 1.0
                winner_elo, loser_elo = avg_b, avg_a
                margin = b_score - a_score
            else:
                s_a, s_b = 0.5, 0.5  # draw
                winner_elo, loser_elo = avg_a, avg_b
                margin = 0

            # Margin + upset bonus multiplier
            if margin > 0:
                M = m_upset_bonus(winner_elo, loser_elo, margin)
            else:
                M = 1.0  # Draws

            # Apply Elo updates
            for pid in team_a_ids:
                ratings[pid] = (
                    ratings.get(pid, INITIAL_ELO) + k_factor * (s_a - exp_a) * M
                )
            for pid in team_b_ids:
                ratings[pid] = (
                    ratings.get(pid, INITIAL_ELO) + k_factor * (s_b - exp_b) * M
                )

        return {pid: int(round(r)) for pid, r in ratings.items()}
