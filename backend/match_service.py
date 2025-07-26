class MatchService:
    def __init__(self, db):
        self.db = db

    def add_match(self, club_a, club_b, team_a, team_b, score_a, score_b):
        query = """
        INSERT INTO matches (club_a, club_b, team_a, team_b, score_a, score_b)
        VALUES (%s, %s, %s, %s, %s, %s);
        """
        self.db.execute(
            query, (club_a, club_b, team_a, team_b, score_a, score_b), commit=True
        )

    def get_matches(self):
        return self.db.execute(
            "SELECT * FROM matches ORDER BY time DESC;", fetch_one=False
        )

    def delete_match(self, match_id):
        query = "DELETE FROM matches WHERE id = %s;"
        self.db.execute(query, (match_id,), commit=True)
        return {"message": f"Match with ID {match_id} deleted successfully."}
