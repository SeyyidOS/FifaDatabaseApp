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


# How much a club's rating counts in a side's strength. A match keeps the board's weight from when it
# was entered, like its club ratings, so changing the weight never rewrites history; the matches
# played so far counted half the club.
V6_CLUB_WEIGHT = """
ALTER TABLE boards ADD COLUMN club_weight DOUBLE PRECISION NOT NULL DEFAULT 0.5;
ALTER TABLE matches ADD COLUMN club_weight DOUBLE PRECISION NOT NULL DEFAULT 0.5;
"""


def v6_club_weight(cur: RealDictCursor) -> None:
    cur.execute(V6_CLUB_WEIGHT)


# Photos of a match (photos.py); the images themselves are files in PHOTO_DIR, named by `file`.
V7_MATCH_PHOTOS = """
CREATE TABLE match_photos (
    id SERIAL PRIMARY KEY,
    match_id INT NOT NULL REFERENCES matches (id) ON DELETE CASCADE,
    file VARCHAR(40) UNIQUE NOT NULL,
    width INT NOT NULL,
    height INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX match_photos_match_idx ON match_photos (match_id);
"""


def v7_match_photos(cur: RealDictCursor) -> None:
    cur.execute(V7_MATCH_PHOTOS)


# A match's numbers from the game's summary screen (board_data.py), keyed by the app's sides A and B,
# typed in or read from one of its photos.
V8_MATCH_STATS = """
CREATE TABLE match_stats (
    match_id INT PRIMARY KEY REFERENCES matches (id) ON DELETE CASCADE,
    stats JSONB NOT NULL,
    source VARCHAR(10) NOT NULL,
    photo_id INT REFERENCES match_photos (id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


def v8_match_stats(cur: RealDictCursor) -> None:
    cur.execute(V8_MATCH_STATS)


# Accounts (accounts.py): a person who signs in with a link sent to their e-mail. Links are stored
# only as SHA-256 hashes, are good for one use and expire after a few minutes.
V9_ACCOUNTS = """
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(254) UNIQUE NOT NULL,
    name VARCHAR(40),
    session_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);
CREATE TABLE login_links (
    id SERIAL PRIMARY KEY,
    token_hash CHAR(64) UNIQUE NOT NULL,
    email VARCHAR(254) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);
"""


def v9_accounts(cur: RealDictCursor) -> None:
    cur.execute(V9_ACCOUNTS)


# Who is in which board (memberships.py): an account's role there and, once known, which of the
# board's players it is. One owner per board; a player belongs to at most one account.
V10_MEMBERSHIPS = """
CREATE TABLE memberships (
    user_id INT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    board_id INT NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('owner', 'admin', 'player')),
    player_id INT REFERENCES players (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, board_id)
);
CREATE UNIQUE INDEX memberships_one_owner ON memberships (board_id) WHERE role = 'owner';
CREATE UNIQUE INDEX memberships_player_key ON memberships (player_id) WHERE player_id IS NOT NULL;
CREATE INDEX memberships_board_idx ON memberships (board_id);
"""


def v10_memberships(cur: RealDictCursor) -> None:
    cur.execute(V10_MEMBERSHIPS)


# Invites (invites.py): a personal link for one player (one use, a week) or the board's group link
# (until reset), and the requests of people who joined by the group link and said which player they are.
V11_INVITES = """
CREATE TABLE invites (
    id SERIAL PRIMARY KEY,
    board_id INT NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    code VARCHAR(32) UNIQUE NOT NULL,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('personal', 'group')),
    player_id INT REFERENCES players (id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    CHECK ((kind = 'personal') = (player_id IS NOT NULL))
);
CREATE UNIQUE INDEX invites_one_group ON invites (board_id) WHERE kind = 'group' AND revoked_at IS NULL;
CREATE TABLE join_requests (
    id SERIAL PRIMARY KEY,
    board_id INT NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    user_id INT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    player_id INT REFERENCES players (id) ON DELETE CASCADE,
    new_name VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (board_id, user_id),
    CHECK ((player_id IS NULL) <> (new_name IS NULL))
);
"""


def v11_invites(cur: RealDictCursor) -> None:
    cur.execute(V11_INVITES)


# Leagues started with an account have no passwords: people come in with invites. Both or neither.
V12_PASSWORDLESS = """
ALTER TABLE boards ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE boards ALTER COLUMN admin_password_hash DROP NOT NULL;
ALTER TABLE boards ADD CONSTRAINT boards_passwords_together
    CHECK ((password_hash IS NULL) = (admin_password_hash IS NULL));
"""


def v12_passwordless(cur: RealDictCursor) -> None:
    cur.execute(V12_PASSWORDLESS)


# Moving an account to a new e-mail address (accounts.py): a one-time link to the new address, stored
# as a hash like a sign-in link; lang is for the note to the old address.
V13_EMAIL_CHANGES = """
CREATE TABLE email_changes (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    email VARCHAR(254) NOT NULL,
    lang VARCHAR(2) NOT NULL,
    token_hash CHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ
);
"""


def v13_email_changes(cur: RealDictCursor) -> None:
    cur.execute(V13_EMAIL_CHANGES)


# An account's photo (avatars.py): the name of its file in PHOTO_DIR/avatars, which changes with each upload.
def v14_account_photos(cur: RealDictCursor) -> None:
    cur.execute("ALTER TABLE users ADD COLUMN photo VARCHAR(40)")


# A sign-in e-mail also carries a six-digit code (accounts.py), kept as a keyed hash; wrong guesses are counted.
def v15_sign_in_codes(cur: RealDictCursor) -> None:
    cur.execute("ALTER TABLE login_links ADD COLUMN code_hash TEXT, ADD COLUMN attempts INT NOT NULL DEFAULT 0")


# Who logged a match (board_data.py), and each fix or take-back after it: who, as what, the score before and
# after, and for a take-back the match itself, which is gone from matches. Not shown in the app; for settling
# "who changed that?". No user means a board password or the server admin key.
V16_MATCH_LOG = """
ALTER TABLE matches ADD COLUMN logged_by INT REFERENCES users (id) ON DELETE SET NULL;
CREATE TABLE match_changes (
    id SERIAL PRIMARY KEY,
    board_id INT NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    match_id INT NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('fix', 'delete')),
    user_id INT REFERENCES users (id) ON DELETE SET NULL,
    role VARCHAR(10) NOT NULL,
    score_a INT NOT NULL,
    score_b INT NOT NULL,
    new_score_a INT,
    new_score_b INT,
    match JSONB,
    at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC')
);
CREATE INDEX match_changes_match_idx ON match_changes (match_id);
"""


def v16_match_log(cur: RealDictCursor) -> None:
    cur.execute(V16_MATCH_LOG)


# Matches being played now (live.py): who (player ids, in order) and which clubs, until a result comes in or
# they are cancelled. Several per board, one per console.
V17_LIVE_MATCHES = """
CREATE TABLE live_matches (
    id SERIAL PRIMARY KEY,
    board_id INT NOT NULL REFERENCES boards (id) ON DELETE CASCADE,
    team_a INT[] NOT NULL,
    team_b INT[] NOT NULL,
    club_a VARCHAR(100) NOT NULL,
    club_b VARCHAR(100) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    started_by INT REFERENCES users (id) ON DELETE SET NULL
);
CREATE INDEX live_matches_board_idx ON live_matches (board_id);
"""


def v17_live_matches(cur: RealDictCursor) -> None:
    cur.execute(V17_LIVE_MATCHES)


MIGRATIONS: list[tuple[int, Callable[[RealDictCursor], None]]] = [
    (1, v1_legacy),
    (2, v2_boards),
    (3, v3_seasons),
    (4, v4_club_model),
    (5, v5_fixtures),
    (6, v6_club_weight),
    (7, v7_match_photos),
    (8, v8_match_stats),
    (9, v9_accounts),
    (10, v10_memberships),
    (11, v11_invites),
    (12, v12_passwordless),
    (13, v13_email_changes),
    (14, v14_account_photos),
    (15, v15_sign_in_codes),
    (16, v16_match_log),
    (17, v17_live_matches),
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
