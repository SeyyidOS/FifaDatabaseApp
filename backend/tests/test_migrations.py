"""Upgrading a database from the original single-group schema to boards."""

import psycopg2
from psycopg2.extras import RealDictCursor

import migrations
from auth import verify_password
from db import Database

LEGACY_DATA = """
INSERT INTO clubs (name, tier, elo) VALUES ('Arsenal', 1, 999), ('Chelsea', 1, 1100);
INSERT INTO players (name) VALUES ('kerem'), ('seyyid'), ('ali'), ('veli');
INSERT INTO matches (time, club_a, club_b, team_a, team_b, score_a, score_b) VALUES
    ('2025-07-27 15:00', 'Arsenal', 'Chelsea', '{kerem,seyyid}', '{ali,veli}', 3, 1),
    ('2025-07-27 16:00', 'Custom FC', 'Arsenal', '{kerem,ghost}', '{ali}', 2, 2),
    ('2025-07-28 15:00', 'Napoli', 'Napoli', '{seyyid}', '{veli,kerem}', 0, 1);
UPDATE elo_settings SET k_factor = 36;
"""


def rows(cur, sql):
    cur.execute(sql)
    return cur.fetchall()


def test_legacy_database_becomes_the_main_board(scratch_database, monkeypatch):
    monkeypatch.setenv("LEGACY_BOARD_PASSWORD", "legacy-member")
    monkeypatch.setenv("LEGACY_BOARD_ADMIN_PASSWORD", "legacy-admin")
    with psycopg2.connect(scratch_database) as conn, conn.cursor() as cur:
        cur.execute(migrations.V1_LEGACY + LEGACY_DATA)  # a database from before migrations existed

    db = Database(dsn=scratch_database)
    try:
        migrations.migrate(db)
        migrations.migrate(db)  # running again changes nothing
    finally:
        db.close()

    with psycopg2.connect(scratch_database, cursor_factory=RealDictCursor) as conn, conn.cursor() as cur:
        [board] = rows(cur, "SELECT * FROM boards")
        assert (board["slug"], board["name"], board["k_factor"]) == ("main", "Main Board", 36)
        assert board["club_weight"] == 0.5
        assert verify_password("legacy-member", board["password_hash"])
        assert verify_password("legacy-admin", board["admin_password_hash"])

        players = {p["name"]: p for p in rows(cur, "SELECT id, name, board_id, archived_at FROM players")}
        assert set(players) == {"kerem", "seyyid", "ali", "veli", "ghost"}
        assert {p["board_id"] for p in players.values()} == {board["id"]}
        # a player who had been deleted comes back archived, so their matches keep counting
        assert players["ghost"]["archived_at"] is not None and players["kerem"]["archived_at"] is None

        teams = rows(
            cur,
            """
            SELECT mp.match_id, mp.side, string_agg(p.name, ',' ORDER BY mp.slot) AS team
            FROM match_players mp JOIN players p ON p.id = mp.player_id
            GROUP BY mp.match_id, mp.side ORDER BY mp.match_id, mp.side
            """,
        )
        assert [(t["match_id"], t["side"], t["team"]) for t in teams] == [
            (1, "A", "kerem,seyyid"),
            (1, "B", "ali,veli"),
            (2, "A", "kerem,ghost"),
            (2, "B", "ali"),
            (3, "A", "seyyid"),
            (3, "B", "veli,kerem"),
        ]

        columns = {
            c["column_name"]
            for c in rows(cur, "SELECT column_name FROM information_schema.columns WHERE table_name = 'matches'")
        }
        assert "team_a" not in columns and "board_id" in columns
        assert rows(cur, "SELECT to_regclass('elo_settings') AS t")[0]["t"] is None
        versions = rows(cur, "SELECT version FROM schema_version ORDER BY version")
        assert [r["version"] for r in versions] == [1, 2, 3, 4, 5, 6, 7]

        # the shared club list becomes the board's first season, and every match keeps its club ratings
        [season] = rows(cur, "SELECT s.*, b.active_season_id FROM seasons s JOIN boards b ON b.id = s.board_id")
        assert (season["name"], season["active_season_id"]) == ("FC26", season["id"])
        clubs = rows(cur, "SELECT name, elo FROM season_clubs ORDER BY name")
        assert [(c["name"], c["elo"]) for c in clubs] == [("Arsenal", 999), ("Chelsea", 1100)]
        played = rows(cur, "SELECT season_id, club_a_elo, club_b_elo FROM matches ORDER BY id")
        assert [(m["season_id"], m["club_a_elo"], m["club_b_elo"]) for m in played] == [
            (season["id"], 999, 1100),
            (season["id"], 500, 999),  # Custom FC was never listed
            (season["id"], 500, 500),
        ]
        assert rows(cur, "SELECT to_regclass('clubs') AS t")[0]["t"] is None


def test_legacy_database_without_clubs_starts_from_the_fc26_list(scratch_database):
    with psycopg2.connect(scratch_database) as conn, conn.cursor() as cur:
        cur.execute(migrations.V1_LEGACY + "INSERT INTO players (name) VALUES ('kerem');")
    db = Database(dsn=scratch_database)
    try:
        migrations.migrate(db)
        assert db.fetch_one("SELECT COUNT(*) AS n FROM season_clubs")["n"] == 45
    finally:
        db.close()


def test_fresh_database_gets_an_empty_board_schema(scratch_database):
    db = Database(dsn=scratch_database)
    try:
        migrations.migrate(db)
        assert db.fetch_one("SELECT COUNT(*) AS n FROM boards")["n"] == 0
        assert db.fetch_one("SELECT COUNT(*) AS n FROM seasons")["n"] == 0
    finally:
        db.close()
