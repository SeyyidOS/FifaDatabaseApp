import psycopg2  # type: ignore
import os
from psycopg2.extras import RealDictCursor  # type: ignore
from dotenv import load_dotenv

load_dotenv()


class Database:
    def __init__(self):
        env = os.getenv("ENV", "local")

        host = os.getenv("DB_HOST")
        if env == "cloud":
            # Use Unix socket for Cloud SQL
            host = f"/cloudsql/{os.getenv('DB_INSTANCE')}"

        self.connection = psycopg2.connect(
            dbname=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASS"),
            host=host,
            port=os.getenv("DB_PORT", 5432),
            cursor_factory=RealDictCursor,
        )
        self.connection.autocommit = True
        self.create_tables()

    def create_tables(self):
        with self.connection.cursor() as cur:
            # Players table
            cur.execute(
                """
            CREATE TABLE IF NOT EXISTS players (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL
            );
            """
            )
            # Clubs table
            cur.execute(
                """
            CREATE TABLE IF NOT EXISTS clubs (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) UNIQUE NOT NULL,
                tier INT NOT NULL
            );
            """
            )
            # Matches table
            cur.execute(
                """
            CREATE TABLE IF NOT EXISTS matches (
                id SERIAL PRIMARY KEY,
                time TIMESTAMP DEFAULT NOW(),
                club_a VARCHAR(100),
                club_b VARCHAR(100),
                team_a TEXT,
                team_b TEXT,
                score_a INT,
                score_b INT
            );
            """
            )

    def execute(self, query, params=None, fetch_one=False, commit=False):
        with self.connection.cursor() as cur:
            cur.execute(query, params)
            if commit:
                self.connection.commit()
                return None
            if fetch_one:
                return cur.fetchone()
            else:
                return cur.fetchall()
