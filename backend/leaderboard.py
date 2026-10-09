"""Standings for a board's players, clubs and two-player duos since a given day."""

import os
from datetime import date
from typing import Literal

from db import Database

Kind = Literal["players", "clubs", "duos"]

# One row per side per match. `since` is a calendar day in APP_TIMEZONE (match times are stored as
# naive UTC), so a day starts at local midnight.
SIDES = """
WITH bounds AS (
    SELECT (%(since)s::date::timestamp AT TIME ZONE %(tz)s) AT TIME ZONE 'UTC' AS since_utc
),
sides AS (
    SELECT m.id AS match_id, s.side,
           CASE WHEN s.side = 'A' THEN m.club_a ELSE m.club_b END AS club,
           CASE WHEN s.side = 'A' THEN m.score_a ELSE m.score_b END AS gf,
           CASE WHEN s.side = 'A' THEN m.score_b ELSE m.score_a END AS ga
    FROM matches m
    CROSS JOIN (VALUES ('A'), ('B')) AS s (side)
    CROSS JOIN bounds
    WHERE m.board_id = %(board)s AND m.time >= bounds.since_utc
),
side_players AS (
    SELECT sides.*, p.name, p.archived_at
    FROM sides
    JOIN match_players mp ON mp.match_id = sides.match_id AND mp.side = sides.side
    JOIN players p ON p.id = mp.player_id
)
"""

TOTALS = """
    SUM((gf > ga)::int) AS wins,
    SUM((gf = ga)::int) AS draws,
    SUM((gf < ga)::int) AS losses,
    COUNT(*) AS total_matches,
    SUM(CASE WHEN gf > ga THEN 3 WHEN gf = ga THEN 1 ELSE 0 END) AS points,
    ROUND(SUM((gf > ga)::int)::numeric / COUNT(*) * 100, 2) AS win_percentage,
    SUM(gf) AS goals_forwarded,
    SUM(ga) AS goals_accepted
"""

# Ties on win rate and games played are broken by points, then name, so the order is stable.
QUERIES: dict[Kind, str] = {
    # archived players leave the table, but their matches still count for everyone else
    "players": f"""{SIDES}
        SELECT name, {TOTALS}
        FROM side_players
        WHERE archived_at IS NULL
        GROUP BY name
        ORDER BY win_percentage DESC, total_matches DESC, points DESC, name""",
    "clubs": f"""{SIDES}
        SELECT club, {TOTALS}
        FROM sides
        GROUP BY club
        ORDER BY win_percentage DESC, total_matches DESC, points DESC, club""",
    # a duo is any side with more than one player, named by its members in alphabetical order
    "duos": f"""{SIDES},
        duo_sides AS (
            SELECT STRING_AGG(name, ' & ' ORDER BY name) AS duo, gf, ga
            FROM side_players
            GROUP BY match_id, side, gf, ga
            HAVING COUNT(*) > 1
        )
        SELECT duo, {TOTALS}
        FROM duo_sides
        GROUP BY duo
        ORDER BY win_percentage DESC, total_matches DESC, points DESC, duo""",
}


def standings(db: Database, board_id: int, kind: Kind, since: date) -> list[dict]:
    tz = os.getenv("APP_TIMEZONE", "Europe/Istanbul")
    return db.fetch_all(QUERIES[kind], {"board": board_id, "since": since, "tz": tz})
