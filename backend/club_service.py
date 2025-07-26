class ClubService:
    def __init__(self, db):
        self.db = db

    def get_clubs(self):
        return self.db.execute(
            "SELECT * FROM clubs ORDER BY tier, name;", fetch_one=False
        )
