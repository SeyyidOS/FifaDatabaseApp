"""Upgrading a database from the original single-group schema to boards."""

import psycopg2
from psycopg2.extras import RealDictCursor

import migrations
from auth import verify_password
from db import Database

LEGACY_DATA = """
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
        assert [r["version"] for r in rows(cur, "SELECT version FROM schema_version ORDER BY version")] == [1, 2]
        assert rows(cur, "SELECT COUNT(*) AS n FROM clubs")[0]["n"] == 45


def test_fresh_database_gets_an_empty_board_schema(scratch_database):
    db = Database(dsn=scratch_database)
    try:
        migrations.migrate(db)
        assert db.fetch_one("SELECT COUNT(*) AS n FROM boards")["n"] == 0
        assert db.fetch_one("SELECT COUNT(*) AS n FROM clubs")["n"] == 45
    finally:
        db.close()
