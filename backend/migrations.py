"""Schema migrations, applied in order at startup. Each one runs in a single transaction."""

import csv
import logging
import os
import secrets
from collections.abc import Callable
from pathlib import Path

from psycopg2.extras import RealDictCursor

from auth import hash_password
from db import Database

log = logging.getLogger("fifa.migrations")

CLUBS_SEED = Path(__file__).parent / "data" / "clubs.csv"

# The original single-group schema. Idempotent, so it is safe on databases that predate migrations.
V1_LEGACY = """
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);
CREATE TABLE IF NOT EXISTS clubs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    tier INT NOT NULL,
    elo INT NOT NULL DEFAULT 500
);
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS elo INT NOT NULL DEFAULT 500;
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
CREATE TABLE IF NOT EXISTS elo_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1,
    k_factor INT NOT NULL DEFAULT 24,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
INSERT INTO elo_settings (id, k_factor) VALUES (1, 24) ON CONFLICT (id) DO NOTHING;
"""


def v1_legacy(cur: RealDictCursor) -> None:
    cur.execute(V1_LEGACY)


# Boards (one per group), archived players, and teams as rows instead of '{a,b}' strings.
V2_BOARDS = """
CREATE TABLE boards (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(60) UNIQUE NOT NULL,
    name VARCHAR(60) NOT NULL,
    password_hash TEXT NOT NULL,
    admin_password_hash TEXT NOT NULL,
    member_version INT NOT NULL DEFAULT 1,
    admin_version INT NOT NULL DEFAULT 1,
    k_factor INT NOT NULL DEFAULT 24,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE players ADD COLUMN board_id INT REFERENCES boards (id) ON DELETE CASCADE;
ALTER TABLE players ADD COLUMN archived_at TIMESTAMPTZ;
ALTER TABLE matches ADD COLUMN board_id INT REFERENCES boards (id) ON DELETE CASCADE;
-- slot keeps the order the team was entered in; players with matches cannot be deleted (archive them)
CREATE TABLE match_players (
    match_id INT NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
    player_id INT NOT NULL REFERENCES players (id),
    side CHAR(1) NOT NULL CHECK (side IN ('A', 'B')),
    slot SMALLINT NOT NULL,
    PRIMARY KEY (match_id, player_id)
);
CREATE INDEX match_players_player_idx ON match_players (player_id);
"""

V2_FINISH = """
ALTER TABLE players DROP CONSTRAINT IF EXISTS players_name_key;
ALTER TABLE players ALTER COLUMN board_id SET NOT NULL;
ALTER TABLE players ADD CONSTRAINT players_board_name_key UNIQUE (board_id, name);
ALTER TABLE matches ALTER COLUMN board_id SET NOT NULL;
ALTER TABLE matches DROP COLUMN team_a, DROP COLUMN team_b;
CREATE INDEX matches_board_time_idx ON matches (board_id, time);
DROP TABLE elo_settings;
"""

LEGACY_SLUG = "main"


def _legacy_names(team: str | None) -> list[str]:
    """'{kerem,seyyid}' -> ['kerem', 'seyyid'] (the old storage format)."""
    cleaned = (
        x.replace("{", "").replace("}", "").replace("(", "").replace(")", "").strip().lower()
        for x in (team or "").split(",")
    )
    return [n for n in cleaned if n]


def _password(env: str, label: str) -> str:
    value = os.getenv(env)
    if value:
        return value
    value = secrets.token_urlsafe(9)
    log.warning("board %r: no %s set, generated %s = %s (change it in Settings)", LEGACY_SLUG, env, label, value)
    return value


def v2_boards(cur: RealDictCursor) -> None:
    cur.execute(V2_BOARDS)
    cur.execute("SELECT (SELECT COUNT(*) FROM players) + (SELECT COUNT(*) FROM matches) AS n")
    if cur.fetchone()["n"]:
        # Everything recorded before boards existed becomes the first board.
        cur.execute("SELECT k_factor FROM elo_settings WHERE id = 1")
        row = cur.fetchone()
        cur.execute(
            """
            INSERT INTO boards (slug, name, password_hash, admin_password_hash, k_factor)
            VALUES (%s, %s, %s, %s, %s) RETURNING id
            """,
            (
                LEGACY_SLUG,
                os.getenv("LEGACY_BOARD_NAME", "Main Board"),
                hash_password(_password("LEGACY_BOARD_PASSWORD", "board password")),
                hash_password(_password("LEGACY_BOARD_ADMIN_PASSWORD", "admin password")),
                row["k_factor"] if row else 24,
            ),
        )
        board_id = cur.fetchone()["id"]
        cur.execute("UPDATE players SET board_id = %s", (board_id,))
        cur.execute("UPDATE matches SET board_id = %s", (board_id,))

        cur.execute("SELECT id, name FROM players")
        ids = {p["name"].strip().lower(): p["id"] for p in cur.fetchall()}
        cur.execute("SELECT id, team_a, team_b FROM matches ORDER BY id")
        for match in cur.fetchall():
            for side, team in (("A", match["team_a"]), ("B", match["team_b"])):
                for slot, name in enumerate(_legacy_names(team)):
                    if name not in ids:
                        # history mentions a player who was deleted: bring them back, archived
                        cur.execute(
                            "INSERT INTO players (board_id, name, archived_at) VALUES (%s, %s, NOW()) RETURNING id",
                            (board_id, name),
                        )
                        ids[name] = cur.fetchone()["id"]
                    cur.execute(
                        """
                        INSERT INTO match_players (match_id, player_id, side, slot)
                        VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING
                        """,
                        (match["id"], ids[name], side, slot),
                    )
    cur.execute(V2_FINISH)


MIGRATIONS: list[tuple[int, Callable[[RealDictCursor], None]]] = [
    (1, v1_legacy),
    (2, v2_boards),
]


def migrate(db: Database) -> None:
    for version, step in MIGRATIONS:
        with db.transaction() as cur:
            cur.execute("SELECT pg_advisory_xact_lock(727274)")  # one migrator at a time
            cur.execute("CREATE TABLE IF NOT EXISTS schema_version (version INT NOT NULL)")
            cur.execute("SELECT COALESCE(MAX(version), 0) AS v FROM schema_version")
            if cur.fetchone()["v"] >= version:
                continue
            step(cur)
            cur.execute("INSERT INTO schema_version (version) VALUES (%s)", (version,))
            log.info("applied migration %d (%s)", version, step.__name__)
    seed_clubs(db)


def seed_clubs(db: Database) -> None:
    with db.transaction() as cur:
        cur.execute("SELECT COUNT(*) AS n FROM clubs")
        if cur.fetchone()["n"] or not CLUBS_SEED.exists():
            return
        with CLUBS_SEED.open(newline="", encoding="utf-8") as f:
            rows = [(r["name"], int(r["tier"]), int(r["elo"])) for r in csv.DictReader(f)]
        cur.executemany("INSERT INTO clubs (name, tier, elo) VALUES (%s, %s, %s)", rows)
        log.info("seeded %d clubs", len(rows))
