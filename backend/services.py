# backend/services.py
import logging
from database import Database

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


class PlayerService:
    def __init__(self, db: Database):
        self.db = db
        self.create_table()

    def create_table(self):
        self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS players (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """,
            commit=True,
        )
        logger.info("Players table ensured.")

    def add_player(self, name: str):
        self.db.execute("INSERT INTO players (name) VALUES (%s);", (name,), commit=True)
        logger.info(f"Player added: {name}")

    def get_players(self):
        return self.db.execute("SELECT * FROM players;", fetch_one=False)


class ClubService:
    def __init__(self, db: Database):
        self.db = db
        self.create_table()
        self.seed_clubs()

    def create_table(self):
        self.db.execute(
            """
            CREATE TABLE IF NOT EXISTS clubs (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                tier INT NOT NULL
            );
        """,
            commit=True,
        )
        logger.info("Clubs table ensured.")

    def seed_clubs(self):
        existing = self.db.execute(
            "SELECT COUNT(*) as count FROM clubs;", fetch_one=True
        )
        if existing["count"] == 0:
            clubs = [
                ("Liverpool", 1),
                ("Arsenal", 1),
                ("City", 1),
                ("Psg", 1),
                ("Bayern", 1),
                ("Barca", 1),
                ("Inter", 1),
                ("Aston Villa", 2),
                ("Chelsea", 2),
                ("Manu", 2),
                ("Newcastle", 2),
                ("Tottenham", 2),
                ("Atletico", 2),
                ("Napoli", 2),
                ("Leverkusen", 2),
            ]
            for club, tier in clubs:
                self.db.execute(
                    "INSERT INTO clubs (name, tier) VALUES (%s, %s);",
                    (club, tier),
                    commit=True,
                )
            logger.info("Clubs seeded.")

    def get_clubs(self):
        return self.db.execute(
            "SELECT * FROM clubs ORDER BY tier, name;", fetch_one=False
        )
