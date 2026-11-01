"""A board's players, matches, ratings and standings."""

from datetime import date, timedelta

import psycopg2.errors
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from psycopg2.extras import Json

import elo
import fixtures
import leaderboard
import photos
from auth import BoardAccess, board_access, board_admin
from schemas import MatchIn, MatchScore, MatchStatsIn, PlayerIn, PlayerUpdate

router = APIRouter(prefix="/boards/{slug}", tags=["board data"])


def _db(request: Request):
    return request.app.state.db


# ----------- Players -----------
PLAYER_COLUMNS = "id, name, archived_at IS NOT NULL AS archived"


@router.get("/players")
def list_players(request: Request, access: BoardAccess = Depends(board_access)):
    """With, for a player linked to an account, its photo (avatars.py) and whether the viewer blocked that
    account (moderation.py); a blocked or suspended account's photo isn't shown."""
    return _db(request).fetch_all(
        """
        SELECT p.id, p.name, p.archived_at IS NOT NULL AS archived,
               CASE WHEN b.user_id IS NULL AND u.banned_at IS NULL THEN u.photo END AS photo,
               m.user_id IS NOT NULL AS account, b.user_id IS NOT NULL AS blocked
        FROM players p
        LEFT JOIN memberships m ON m.player_id = p.id
        LEFT JOIN users u ON u.id = m.user_id
        LEFT JOIN user_blocks b ON b.user_id = %(me)s AND b.blocked_id = m.user_id
        WHERE p.board_id = %(board)s ORDER BY p.id
        """,
        {"me": access.user_id, "board": access.id},
    )


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
        f"""
        SELECT m.id, m.time, m.season_id, m.club_a, m.club_b, m.club_a_elo, m.club_b_elo, m.club_weight,
               m.score_a, m.score_b,
               ARRAY_AGG(p.name ORDER BY mp.slot) FILTER (WHERE mp.side = 'A') AS team_a,
               ARRAY_AGG(p.name ORDER BY mp.slot) FILTER (WHERE mp.side = 'B') AS team_b,
               ARRAY(SELECT ph.id FROM match_photos ph WHERE ph.match_id = m.id AND {photos.SHOWN}
                     ORDER BY ph.id) AS photos,
               (SELECT json_build_object('A', s.stats -> 'A', 'B', s.stats -> 'B', 'source', s.source,
                                         'photoId', s.photo_id)
                FROM match_stats s WHERE s.match_id = m.id) AS stats
        FROM matches m
        LEFT JOIN match_players mp ON mp.match_id = m.id
        LEFT JOIN players p ON p.id = mp.player_id
        WHERE m.board_id = %(board)s
        GROUP BY m.id
        ORDER BY m.time DESC, m.id DESC
        """,
        {"board": access.id, "me": access.user_id},
    )


def players_for(request: Request, board_id: int, names: list[str]) -> dict[str, dict]:
    """The board's players with these names, all of whom must exist and not be archived (422 otherwise)."""
    rows = _db(request).fetch_all(
        "SELECT id, name, archived_at IS NOT NULL AS archived FROM players WHERE board_id = %s AND name = ANY(%s)",
        (board_id, names),
    )
    found = {r["name"]: r for r in rows}
    unknown = [n for n in names if n not in found]
    if unknown:
        raise HTTPException(status_code=422, detail=f"Unknown players: {', '.join(unknown)}")
    archived = [n for n in names if found[n]["archived"]]
    if archived:
        raise HTTPException(status_code=422, detail=f"Archived players can't play: {', '.join(archived)}")
    return found


def _end_live(cur, board_id: int, team_a: list[int], team_b: list[int]) -> None:
    """A result came in: the oldest match being played (live.py) between these two sides is over."""
    cur.execute(
        """
        DELETE FROM live_matches WHERE id = (
            SELECT id FROM live_matches
            WHERE board_id = %s AND (
                (team_a <@ %s::int[] AND team_a @> %s::int[] AND team_b <@ %s::int[] AND team_b @> %s::int[])
                OR (team_a <@ %s::int[] AND team_a @> %s::int[] AND team_b <@ %s::int[] AND team_b @> %s::int[]))
            ORDER BY started_at, id LIMIT 1
        )
        """,
        (board_id, team_a, team_a, team_b, team_b, team_b, team_b, team_a, team_a),
    )


@router.post("/matches", status_code=201)
def add_match(match: MatchIn, request: Request, access: BoardAccess = Depends(board_access)):
    found = players_for(request, access.id, match.teamA + match.teamB)

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
                (board_id, season_id, time, club_a, club_b, club_a_elo, club_b_elo, score_a, score_b, club_weight,
                 logged_by)
            SELECT id, active_season_id, NOW() AT TIME ZONE 'UTC', %s, %s, %s, %s, %s, %s, club_weight, %s
            FROM boards WHERE id = %s RETURNING id
            """,
            (club_a, club_b, club_a_elo, club_b_elo, match.scoreA, match.scoreB, access.user_id, access.id),
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
        _end_live(cur, access.id, *ids)
    return {"message": "Match added successfully.", "id": match_id}


# a wrong score is usually noticed at once: for this long anyone on the board can put it right or take the
# match back; after that only admins can, so the history stays put
FIX_WINDOW = timedelta(minutes=15)


def _check_fixable(cur, access: BoardAccess, match_id: int) -> dict:
    """The match as it is now, if this device may still change it (locked against a change at the same time)."""
    cur.execute(
        """
        SELECT m.time, m.club_a, m.club_b, m.score_a, m.score_b, m.logged_by,
               (NOW() AT TIME ZONE 'UTC') - m.time <= %s AS recent,
               ARRAY(SELECT p.name FROM match_players mp JOIN players p ON p.id = mp.player_id
                     WHERE mp.match_id = m.id AND mp.side = 'A' ORDER BY mp.slot) AS team_a,
               ARRAY(SELECT p.name FROM match_players mp JOIN players p ON p.id = mp.player_id
                     WHERE mp.match_id = m.id AND mp.side = 'B' ORDER BY mp.slot) AS team_b
        FROM matches m WHERE m.id = %s AND m.board_id = %s FOR UPDATE OF m
        """,
        (FIX_WINDOW, match_id, access.id),
    )
    row = cur.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail=f"No match with ID {match_id}")
    if access.role != "admin" and not row["recent"]:
        raise HTTPException(status_code=403, detail="After 15 minutes only the board's admins can change a match")
    return row


def _log_change(cur, access: BoardAccess, match_id: int, before: dict, action: str, new: MatchScore | None = None):
    """Who fixed or took back a match, and from what (match_changes); a take-back keeps the match too."""
    match = None
    if action == "delete":
        match = {
            "time": before["time"].isoformat(),
            "clubA": before["club_a"],
            "clubB": before["club_b"],
            "teamA": before["team_a"],
            "teamB": before["team_b"],
            "loggedBy": before["logged_by"],
        }
    cur.execute(
        """
        INSERT INTO match_changes
            (board_id, match_id, action, user_id, role, score_a, score_b, new_score_a, new_score_b, match)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            access.id,
            match_id,
            action,
            access.user_id,
            access.role,
            before["score_a"],
            before["score_b"],
            new.scoreA if new else None,
            new.scoreB if new else None,
            Json(match) if match else None,
        ),
    )


@router.patch("/matches/{match_id}")
def fix_score(match_id: int, body: MatchScore, request: Request, access: BoardAccess = Depends(board_access)):
    """Put a wrong score right; ratings follow, as they are worked out from the matches."""
    with _db(request).transaction() as cur:
        before = _check_fixable(cur, access, match_id)
        cur.execute(
            "UPDATE matches SET score_a = %s, score_b = %s WHERE id = %s AND board_id = %s",
            (body.scoreA, body.scoreB, match_id, access.id),
        )
        _log_change(cur, access, match_id, before, "fix", body)
    return {"message": f"Match {match_id} updated.", "scoreA": body.scoreA, "scoreB": body.scoreB}


@router.delete("/matches/{match_id}")
def delete_match(match_id: int, request: Request, access: BoardAccess = Depends(board_access)):
    """A logged match taken back; a planned match it ticked off is open again (fixture_matches)."""
    with _db(request).transaction() as cur:
        before = _check_fixable(cur, access, match_id)
        _log_change(cur, access, match_id, before, "delete")
        cur.execute("SELECT file FROM match_photos WHERE match_id = %s", (match_id,))
        files = [r["file"] for r in cur.fetchall()]
        cur.execute("DELETE FROM matches WHERE id = %s AND board_id = %s", (match_id, access.id))
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"No match with ID {match_id}")
    # its photos went with it
    photos.remove_files(files)
    return {"message": f"Match {match_id} deleted."}


# ----------- Match stats -----------
@router.put("/matches/{match_id}/stats")
def save_match_stats(match_id: int, body: MatchStatsIn, request: Request, access: BoardAccess = Depends(board_access)):
    """Typed in or read from a photo (the game's summary screen); anyone on the board may set them."""
    db = _db(request)
    if db.fetch_one("SELECT 1 FROM matches WHERE id = %s AND board_id = %s", (match_id, access.id)) is None:
        raise HTTPException(status_code=404, detail=f"No match with ID {match_id}")
    if body.photoId is not None and not db.fetch_one(
        "SELECT 1 FROM match_photos WHERE id = %s AND match_id = %s", (body.photoId, match_id)
    ):
        raise HTTPException(status_code=422, detail=f"Photo {body.photoId} is not a photo of this match")
    stats = {side: getattr(body, side).model_dump(exclude_none=True) for side in ("A", "B")}
    db.execute(
        """
        INSERT INTO match_stats (match_id, stats, source, photo_id) VALUES (%s, %s, %s, %s)
        ON CONFLICT (match_id) DO UPDATE
        SET stats = EXCLUDED.stats, source = EXCLUDED.source, photo_id = EXCLUDED.photo_id, updated_at = NOW()
        """,
        (match_id, Json(stats), body.source, body.photoId),
    )
    return {**stats, "source": body.source, "photoId": body.photoId}


@router.delete("/matches/{match_id}/stats")
def delete_match_stats(match_id: int, request: Request, access: BoardAccess = Depends(board_access)):
    removed = _db(request).execute(
        "DELETE FROM match_stats s USING matches m WHERE s.match_id = %s AND m.id = s.match_id AND m.board_id = %s",
        (match_id, access.id),
    )
    if not removed:
        raise HTTPException(status_code=404, detail=f"Match {match_id} has no stats")
    return {"message": f"Stats of match {match_id} deleted."}


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
