class PlayerService:
    def __init__(self, db):
        self.db = db

    def add_player(self, name):
        query = "INSERT INTO players (name) VALUES (%s) ON CONFLICT (name) DO NOTHING;"
        self.db.execute(query, (name,), commit=True)

    def get_players(self):
        return self.db.execute(
            "SELECT * FROM players ORDER BY id ASC;", fetch_one=False
        )

    def delete_player(self, player_id):
        query = "DELETE FROM players WHERE id = %s;"
        self.db.execute(query, (player_id,), commit=True)
        return {"message": f"Player with ID {player_id} deleted successfully."}
