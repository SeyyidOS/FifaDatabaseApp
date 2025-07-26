from database import Database


class LeaderboardService:
    def __init__(self, db: Database):
        self.db = db

    def get_player_leaderboard(self):
        print("Fetching player leaderboard sorted by win percentage...")
        query = """
        SELECT
            p.name AS name,
            COALESCE(SUM(
                CASE WHEN (m.score_a > m.score_b AND p.name = ANY(string_to_array(trim(both '{}' from m.team_a), ',')))
                        OR (m.score_b > m.score_a AND p.name = ANY(string_to_array(trim(both '{}' from m.team_b), ',')))
                    THEN 1 ELSE 0 END
            ), 0) AS wins,
            COALESCE(SUM(
                CASE WHEN m.score_a = m.score_b AND (p.name = ANY(string_to_array(trim(both '{}' from m.team_a), ','))
                        OR p.name = ANY(string_to_array(trim(both '{}' from m.team_b), ',')))
                    THEN 1 ELSE 0 END
            ), 0) AS draws,
            COALESCE(SUM(
                CASE WHEN (m.score_a < m.score_b AND p.name = ANY(string_to_array(trim(both '{}' from m.team_a), ',')))
                        OR (m.score_b < m.score_a AND p.name = ANY(string_to_array(trim(both '{}' from m.team_b), ',')))
                    THEN 1 ELSE 0 END
            ), 0) AS losses,
            COUNT(m.id) AS total_matches,
            (COALESCE(SUM(
                CASE WHEN (m.score_a > m.score_b AND p.name = ANY(string_to_array(trim(both '{}' from m.team_a), ',')))
                        OR (m.score_b > m.score_a AND p.name = ANY(string_to_array(trim(both '{}' from m.team_b), ',')))
                    THEN 3
                    WHEN m.score_a = m.score_b AND (p.name = ANY(string_to_array(trim(both '{}' from m.team_a), ','))
                        OR p.name = ANY(string_to_array(trim(both '{}' from m.team_b), ',')))
                    THEN 1 ELSE 0 END
            ), 0)) AS points,
            ROUND(
                (
                    COALESCE(SUM(
                        CASE WHEN (m.score_a > m.score_b AND p.name = ANY(string_to_array(trim(both '{}' from m.team_a), ',')))
                                OR (m.score_b > m.score_a AND p.name = ANY(string_to_array(trim(both '{}' from m.team_b), ',')))
                            THEN 1 ELSE 0 END
                    ), 0)::numeric
                    / NULLIF(COUNT(m.id), 0)
                ) * 100,
                2
            ) AS win_percentage,
            COALESCE(SUM(
                CASE
                    WHEN p.name = ANY(string_to_array(trim(both '{}' from m.team_a), ',')) THEN m.score_a
                    WHEN p.name = ANY(string_to_array(trim(both '{}' from m.team_b), ',')) THEN m.score_b
                    ELSE 0
                END
            ), 0) AS goals_forwarded,
            COALESCE(SUM(
                CASE
                    WHEN p.name = ANY(string_to_array(trim(both '{}' from m.team_a), ',')) THEN m.score_b
                    WHEN p.name = ANY(string_to_array(trim(both '{}' from m.team_b), ',')) THEN m.score_a
                    ELSE 0
                END
            ), 0) AS goals_accepted
        FROM players p
        LEFT JOIN matches m
        ON p.name = ANY(string_to_array(trim(both '{}' from m.team_a), ','))
        OR p.name = ANY(string_to_array(trim(both '{}' from m.team_b), ','))
        GROUP BY p.name
        ORDER BY win_percentage DESC, total_matches DESC;
        """
        return self.db.execute(query, fetch_one=False)

    def get_team_leaderboard(self):
        print("Fetching team leaderboard sorted by win percentage...")
        query = """
        SELECT
            club AS team,
            SUM(CASE WHEN is_winner = 1 THEN 1 ELSE 0 END) AS wins,
            SUM(CASE WHEN is_winner = 0 THEN 1 ELSE 0 END) AS draws,
            SUM(CASE WHEN is_winner = -1 THEN 1 ELSE 0 END) AS losses,
            COUNT(*) AS total_matches,
            SUM(
                CASE WHEN is_winner = 1 THEN 3 WHEN is_winner = 0 THEN 1 ELSE 0 END
            ) AS points,
            ROUND(
                (
                    SUM(CASE WHEN is_winner = 1 THEN 1 ELSE 0 END)::numeric
                    / NULLIF(COUNT(*), 0)
                ) * 100,
                2
            ) AS win_percentage,
            SUM(goals_forwarded) AS goals_forwarded,
            SUM(goals_accepted) AS goals_accepted
        FROM (
            SELECT
                club_a AS club,
                CASE
                    WHEN score_a > score_b THEN 1
                    WHEN score_a = score_b THEN 0
                    ELSE -1
                END AS is_winner,
                score_a AS goals_forwarded,
                score_b AS goals_accepted
            FROM matches
            UNION ALL
            SELECT
                club_b AS club,
                CASE
                    WHEN score_b > score_a THEN 1
                    WHEN score_b = score_a THEN 0
                    ELSE -1
                END AS is_winner,
                score_b AS goals_forwarded,
                score_a AS goals_accepted
            FROM matches
        ) AS all_teams
        GROUP BY club
        ORDER BY win_percentage DESC, total_matches DESC;
        """
        return self.db.execute(query, fetch_one=False)

    def get_duo_leaderboard(self):
        print("Fetching duo (2-player) team leaderboard sorted by win percentage...")
        query = """
        SELECT
            team_name,
            SUM(CASE WHEN is_winner = 1 THEN 1 ELSE 0 END) AS wins,
            SUM(CASE WHEN is_winner = 0 THEN 1 ELSE 0 END) AS draws,
            SUM(CASE WHEN is_winner = -1 THEN 1 ELSE 0 END) AS losses,
            COUNT(*) AS total_matches,
            SUM(
                CASE WHEN is_winner = 1 THEN 3 WHEN is_winner = 0 THEN 1 ELSE 0 END
            ) AS points,
            ROUND(
                (
                    SUM(CASE WHEN is_winner = 1 THEN 1 ELSE 0 END)::numeric
                    / NULLIF(COUNT(*), 0)
                ) * 100,
                2
            ) AS win_percentage,
            SUM(goals_forwarded) AS goals_forwarded,
            SUM(goals_accepted) AS goals_accepted
        FROM (
            SELECT
                array_to_string(
                    ARRAY(
                        SELECT unnest(string_to_array(trim(both '{}' from m.team_a), ','))
                        ORDER BY unnest
                    ),
                    ' & '
                ) AS team_name,
                CASE
                    WHEN m.score_a > m.score_b THEN 1
                    WHEN m.score_a = m.score_b THEN 0
                    ELSE -1
                END AS is_winner,
                m.score_a AS goals_forwarded,
                m.score_b AS goals_accepted
            FROM matches m
            WHERE array_length(string_to_array(trim(both '{}' from m.team_a), ','), 1) > 1

            UNION ALL

            SELECT
                array_to_string(
                    ARRAY(
                        SELECT unnest(string_to_array(trim(both '{}' from m.team_b), ','))
                        ORDER BY unnest
                    ),
                    ' & '
                ) AS team_name,
                CASE
                    WHEN m.score_b > m.score_a THEN 1
                    WHEN m.score_b = m.score_a THEN 0
                    ELSE -1
                END AS is_winner,
                m.score_b AS goals_forwarded,
                m.score_a AS goals_accepted
            FROM matches m
            WHERE array_length(string_to_array(trim(both '{}' from m.team_b), ','), 1) > 1
        ) AS duo_teams
        GROUP BY team_name
        ORDER BY win_percentage DESC, total_matches DESC;
        """
        return self.db.execute(query, fetch_one=False)
