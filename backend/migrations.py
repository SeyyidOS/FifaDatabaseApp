"""Schema migrations, applied in order at startup. Each one runs in a single transaction."""

import logging
import os
import secrets
from collections.abc import Callable

from psycopg2.extras import RealDictCursor

from auth import hash_password
from db import Database
from elo import DEFAULT_CLUB_ELO
from seasons import read_template

log = logging.getLogger("fifa.migrations")

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


# Clubs per board, grouped into seasons (FC26, FC27, ...). Every match keeps the club ratings it was
# played with, so re-rating clubs for a new game never rewrites anyone's history.
V3_SEASONS = """
CREATE TABLE seasons (
    id SERIAL PRIMARY KEY,
    board_id INT NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    name VARCHAR(40) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX seasons_board_name_key ON seasons (board_id, LOWER(name));
CREATE TABLE season_clubs (
    id SERIAL PRIMARY KEY,
    season_id INT NOT NULL REFERENCES seasons (id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    elo INT NOT NULL
);
CREATE UNIQUE INDEX season_clubs_name_key ON season_clubs (season_id, LOWER(name));
-- the season new matches are recorded in
ALTER TABLE boards ADD COLUMN active_season_id INT REFERENCES seasons (id);
ALTER TABLE matches ADD COLUMN season_id INT REFERENCES seasons (id);
ALTER TABLE matches ADD COLUMN club_a_elo INT, ADD COLUMN club_b_elo INT;
"""

V3_FINISH = """
ALTER TABLE matches ALTER COLUMN season_id SET NOT NULL;
ALTER TABLE matches ALTER COLUMN club_a_elo SET NOT NULL;
ALTER TABLE matches ALTER COLUMN club_b_elo SET NOT NULL;
DROP TABLE clubs;
"""

LEGACY_SEASON = "FC26"


def v3_seasons(cur: RealDictCursor) -> None:
    cur.execute(V3_SEASONS)
    # the shared club list every rating so far was calculated with (seeded from FC26 if never filled)
    cur.execute("SELECT name, elo FROM clubs ORDER BY id")
    clubs = [(c["name"], c["elo"]) for c in cur.fetchall()] or [c[:2] for c in read_template(LEGACY_SEASON)]
    cur.execute("SELECT id FROM boards ORDER BY id")
    for board in cur.fetchall():
        cur.execute("INSERT INTO seasons (board_id, name) VALUES (%s, %s) RETURNING id", (board["id"], LEGACY_SEASON))
        season_id = cur.fetchone()["id"]
        cur.executemany(
            "INSERT INTO season_clubs (season_id, name, elo) VALUES (%s, %s, %s)",
            [(season_id, name, elo) for name, elo in clubs],
        )
        cur.execute("UPDATE boards SET active_season_id = %s WHERE id = %s", (season_id, board["id"]))
    # exact names, as the Elo replay looked them up; clubs that were never listed counted as the default
    cur.execute(
        """
        UPDATE matches m
        SET season_id = b.active_season_id,
            club_a_elo = COALESCE(
                (SELECT c.elo FROM season_clubs c WHERE c.season_id = b.active_season_id AND c.name = m.club_a), %(d)s
            ),
            club_b_elo = COALESCE(
                (SELECT c.elo FROM season_clubs c WHERE c.season_id = b.active_season_id AND c.name = m.club_b), %(d)s
            )
        FROM boards b
        WHERE b.id = m.board_id
        """,
        {"d": DEFAULT_CLUB_ELO},
    )
    cur.execute(V3_FINISH)


# Seasons rated by a card model (FC27 onwards): each club remembers its EA id, the model's rating
# and the admin's correction on top of it, so re-running the model keeps the corrections.
V4_CLUB_MODEL = """
ALTER TABLE season_clubs ADD COLUMN ea_id INT;
ALTER TABLE season_clubs ADD COLUMN model_elo INT;
ALTER TABLE season_clubs ADD COLUMN adjust INT NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX season_clubs_ea_key ON season_clubs (season_id, ea_id);
ALTER TABLE seasons ADD COLUMN game VARCHAR(10);
ALTER TABLE seasons ADD COLUMN model JSONB;
"""


def v4_club_model(cur: RealDictCursor) -> None:
    cur.execute(V4_CLUB_MODEL)


# The night's plan (fixtures.py): one open plan per board; a recorded match ticks off its planned match.
V5_FIXTURES = """
CREATE TABLE fixtures (
    id SERIAL PRIMARY KEY,
    board_id INT NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    rules JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX fixtures_open_key ON fixtures (board_id) WHERE closed_at IS NULL;
CREATE TABLE fixture_matches (
    fixture_id INT NOT NULL REFERENCES fixtures (id) ON DELETE CASCADE,
    slot SMALLINT NOT NULL,
    team_a INT[] NOT NULL,
    team_b INT[] NOT NULL,
    match_id INT REFERENCES matches (id) ON DELETE SET NULL,
    skipped BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (fixture_id, slot)
);
"""


def v5_fixtures(cur: RealDictCursor) -> None:
    cur.execute(V5_FIXTURES)


MIGRATIONS: list[tuple[int, Callable[[RealDictCursor], None]]] = [
    (1, v1_legacy),
    (2, v2_boards),
    (3, v3_seasons),
    (4, v4_club_model),
    (5, v5_fixtures),
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
