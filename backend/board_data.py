"""A board's players, matches, ratings and standings."""

from datetime import date

import psycopg2.errors
from fastapi import APIRouter, Depends, HTTPException, Query, Request

import elo
import fixtures
import leaderboard
import photos
from auth import BoardAccess, board_access, board_admin
from schemas import MatchIn, PlayerIn, PlayerUpdate

router = APIRouter(prefix="/boards/{slug}", tags=["board data"])


def _db(request: Request):
    return request.app.state.db


# ----------- Players -----------
PLAYER_COLUMNS = "id, name, archived_at IS NOT NULL AS archived"


@router.get("/players")
def list_players(request: Request, access: BoardAccess = Depends(board_access)):
    return _db(request).fetch_all(f"SELECT {PLAYER_COLUMNS} FROM players WHERE board_id = %s ORDER BY id", (access.id,))


def _name_taken(request: Request, board_id: int, name: str) -> HTTPException:
    existing = _db(request).fetch_one(
        "SELECT archived_at IS NOT NULL AS archived FROM players WHERE board_id = %s AND name = %s", (board_id, name)
    )
    if existing and existing["archived"]:
        return HTTPException(status_code=409, detail=f"{name} is archived; restore them in Settings")
    return HTTPException(status_code=409, detail=f"{name} is already on the roster")


@router.post("/players", status_code=201)
def add_player(player: PlayerIn, request: Request, access: BoardAccess = Depends(board_access)):
    row = _db(request).write_one(
        f"""
        INSERT INTO players (board_id, name) VALUES (%s, %s)
        ON CONFLICT (board_id, name) DO NOTHING RETURNING {PLAYER_COLUMNS}
        """,
        (access.id, player.name),
    )
    if row is None:
        raise _name_taken(request, access.id, player.name)
    return row


@router.patch("/players/{player_id}")
def update_player(player_id: int, body: PlayerUpdate, request: Request, access: BoardAccess = Depends(board_admin)):
    """Rename and/or archive (archived players leave the roster; their history stays)."""
    sets, params = [], {"id": player_id, "board": access.id}
    if body.name is not None:
        sets.append("name = %(name)s")
        params["name"] = body.name
    if body.archived is not None:
        sets.append("archived_at = CASE WHEN %(archived)s THEN COALESCE(archived_at, NOW()) END")
        params["archived"] = body.archived
    if not sets:
        raise HTTPException(status_code=422, detail="Nothing to change")
    try:
        row = _db(request).write_one(
            f"UPDATE players SET {', '.join(sets)} WHERE id = %(id)s AND board_id = %(board)s "
            f"RETURNING {PLAYER_COLUMNS}",
            params,
        )
    except psycopg2.errors.UniqueViolation as exc:
        raise _name_taken(request, access.id, body.name or "") from exc
    if row is None:
        raise HTTPException(status_code=404, detail=f"No player with ID {player_id}")
    return row


@router.delete("/players/{player_id}")
def delete_player(player_id: int, request: Request, access: BoardAccess = Depends(board_admin)):
    """Only players without matches can be deleted (typos); everyone else is archived instead."""
    db = _db(request)
    player = db.fetch_one(
        """
        SELECT p.name, COUNT(mp.match_id) AS matches
        FROM players p LEFT JOIN match_players mp ON mp.player_id = p.id
        WHERE p.id = %s AND p.board_id = %s
        GROUP BY p.id
        """,
        (player_id, access.id),
    )
    if player is None:
        raise HTTPException(status_code=404, detail=f"No player with ID {player_id}")
    if player["matches"]:
        raise HTTPException(
            status_code=409, detail=f"{player['name']} has played {player['matches']} matches; archive them instead"
        )
    db.execute("DELETE FROM players WHERE id = %s", (player_id,))
    return {"message": f"Player {player['name']} deleted."}


# ----------- Matches -----------
@router.get("/matches")
def list_matches(request: Request, access: BoardAccess = Depends(board_access)):
    return _db(request).fetch_all(
        """
        SELECT m.id, m.time, m.season_id, m.club_a, m.club_b, m.club_a_elo, m.club_b_elo, m.club_weight,
               m.score_a, m.score_b,
               ARRAY_AGG(p.name ORDER BY mp.slot) FILTER (WHERE mp.side = 'A') AS team_a,
               ARRAY_AGG(p.name ORDER BY mp.slot) FILTER (WHERE mp.side = 'B') AS team_b,
               ARRAY(SELECT ph.id FROM match_photos ph WHERE ph.match_id = m.id ORDER BY ph.id) AS photos
        FROM matches m
        LEFT JOIN match_players mp ON mp.match_id = m.id
        LEFT JOIN players p ON p.id = mp.player_id
        WHERE m.board_id = %s
        GROUP BY m.id
        ORDER BY m.time DESC, m.id DESC
        """,
        (access.id,),
    )


@router.post("/matches", status_code=201)
def add_match(match: MatchIn, request: Request, access: BoardAccess = Depends(board_access)):
    names = match.teamA + match.teamB
    rows = _db(request).fetch_all(
        "SELECT id, name, archived_at IS NOT NULL AS archived FROM players WHERE board_id = %s AND name = ANY(%s)",
        (access.id, names),
    )
    found = {r["name"]: r for r in rows}
    unknown = [n for n in names if n not in found]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown players: {', '.join(unknown)}")
    archived = [n for n in names if found[n]["archived"]]
    if archived:
        raise HTTPException(status_code=422, detail=f"Archived players can't play: {', '.join(archived)}")

    with _db(request).transaction() as cur:
        # the active season's clubs, matched case-insensitively; other names are custom clubs
        cur.execute(
            """
            SELECT c.name, c.elo FROM boards b JOIN season_clubs c ON c.season_id = b.active_season_id
            WHERE b.id = %s AND LOWER(c.name) IN (LOWER(%s), LOWER(%s))
            """,
            (access.id, match.clubA, match.clubB),
        )
        listed = {c["name"].lower(): c for c in cur.fetchall()}

        def club(name: str) -> tuple[str, int]:
            row = listed.get(name.lower())
            return (row["name"], row["elo"]) if row else (name, elo.DEFAULT_CLUB_ELO)

        (club_a, club_a_elo), (club_b, club_b_elo) = club(match.clubA), club(match.clubB)
        # the club ratings and the board's club weight are kept with the match; time is stored as UTC
        # whatever the server's time zone
        cur.execute(
            """
            INSERT INTO matches
                (board_id, season_id, time, club_a, club_b, club_a_elo, club_b_elo, score_a, score_b, club_weight)
            SELECT id, active_season_id, NOW() AT TIME ZONE 'UTC', %s, %s, %s, %s, %s, %s, club_weight
            FROM boards WHERE id = %s RETURNING id
            """,
            (club_a, club_b, club_a_elo, club_b_elo, match.scoreA, match.scoreB, access.id),
        )
        match_id = cur.fetchone()["id"]
        cur.executemany(
            "INSERT INTO match_players (match_id, player_id, side, slot) VALUES (%s, %s, %s, %s)",
            [
                (match_id, found[n]["id"], side, slot)
                for side, team in (("A", match.teamA), ("B", match.teamB))
                for slot, n in enumerate(team)
            ],
        )
        ids = [[found[n]["id"] for n in team] for team in (match.teamA, match.teamB)]
        fixtures.tick_off(cur, access.id, match_id, *ids)
    return {"message": "Match added successfully.", "id": match_id}


@router.delete("/matches/{match_id}")
def delete_match(match_id: int, request: Request, access: BoardAccess = Depends(board_admin)):
    with _db(request).transaction() as cur:
        cur.execute("SELECT file FROM match_photos WHERE match_id = %s", (match_id,))
        files = [r["file"] for r in cur.fetchall()]
        cur.execute("DELETE FROM matches WHERE id = %s AND board_id = %s", (match_id, access.id))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"No match with ID {match_id}")
    # its photos went with it
    photos.remove_files(files)
    return {"message": f"Match {match_id} deleted."}


# ----------- Ratings & standings -----------
@router.get("/elo")
def ratings(
    request: Request, k: int | None = Query(default=None, ge=1, le=200), access: BoardAccess = Depends(board_access)
):
    """Current ratings replayed from all matches; ?k= overrides the board's K-factor for this call only."""
    result = elo.board_ratings(_db(request), access.id, k if k is not None else access.k_factor)
    return {"ratings": [{"playerId": pid, "elo": rating} for pid, rating in result.items()]}


@router.get("/leaderboard/{kind}")
def standings(
    kind: leaderboard.Kind,
    request: Request,
    start_time: date = Query(...),
    access: BoardAccess = Depends(board_access),
):
    return leaderboard.standings(_db(request), access.id, kind, start_time)
