"""Matches being played now: started on one device with their teams and clubs, finished on any.

The Match Center shows them at the top ("being played"); entering the result there saves an ordinary match
(board_data.add_match), which also ends the oldest one between the same two sides. Starting one saves
nothing else, and one forgotten for LIVE_FOR is dropped. Several can be played at once (more consoles).
"""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request

from auth import BoardAccess, board_access
from board_data import players_for
from schemas import LiveMatchIn

router = APIRouter(prefix="/boards/{slug}/live", tags=["live matches"])

LIVE_FOR = timedelta(hours=3)

LIVE_COLUMNS = """
    l.id, l.club_a, l.club_b, l.started_at,
    ARRAY(SELECT p.name FROM unnest(l.team_a) WITH ORDINALITY AS t (pid, i) JOIN players p ON p.id = t.pid ORDER BY t.i)
        AS team_a,
    ARRAY(SELECT p.name FROM unnest(l.team_b) WITH ORDINALITY AS t (pid, i) JOIN players p ON p.id = t.pid ORDER BY t.i)
        AS team_b
"""


def _public(row: dict) -> dict:
    return {
        "id": row["id"],
        "teamA": row["team_a"],
        "teamB": row["team_b"],
        "clubA": row["club_a"],
        "clubB": row["club_b"],
        "startedAt": row["started_at"],
    }


def _utc_now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


@router.get("")
def list_live(request: Request, access: BoardAccess = Depends(board_access)):
    """The matches being played on this board, oldest first."""
    rows = request.app.state.db.fetch_all(
        f"SELECT {LIVE_COLUMNS} FROM live_matches l WHERE l.board_id = %s AND l.started_at > %s "
        "ORDER BY l.started_at, l.id",
        (access.id, _utc_now() - LIVE_FOR),
    )
    return [_public(r) for r in rows]


@router.post("", status_code=201)
def start(body: LiveMatchIn, request: Request, access: BoardAccess = Depends(board_access)):
    found = players_for(request, access.id, body.teamA + body.teamB)
    team_a, team_b = ([found[n]["id"] for n in team] for team in (body.teamA, body.teamB))
    now = _utc_now()
    started = body.startedAt
    if started is not None and started.tzinfo is not None:
        started = started.astimezone(UTC).replace(tzinfo=None)
    # one brought back keeps its start, within reason
    if started is None or started > now or started <= now - LIVE_FOR:
        started = now
    with request.app.state.db.transaction() as cur:
        cur.execute("DELETE FROM live_matches WHERE board_id = %s AND started_at <= %s", (access.id, now - LIVE_FOR))
        if body.replaces is not None:
            cur.execute("DELETE FROM live_matches WHERE id = %s AND board_id = %s", (body.replaces, access.id))
        if not body.force:
            # a player can't be in two matches at once: most likely a result that wasn't entered
            cur.execute(
                """
                SELECT DISTINCT p.name FROM live_matches l
                JOIN players p ON p.id = ANY(l.team_a || l.team_b)
                WHERE l.board_id = %s AND p.id = ANY(%s) ORDER BY p.name
                """,
                (access.id, team_a + team_b),
            )
            busy = [r["name"] for r in cur.fetchall()]
            if busy:
                raise HTTPException(status_code=409, detail=f"Already in a match being played: {', '.join(busy)}")
        cur.execute(
            """
            INSERT INTO live_matches (board_id, team_a, team_b, club_a, club_b, started_at, started_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (access.id, team_a, team_b, body.clubA, body.clubB, started, access.user_id),
        )
        live_id = cur.fetchone()["id"]
        cur.execute(f"SELECT {LIVE_COLUMNS} FROM live_matches l WHERE l.id = %s", (live_id,))
        return _public(cur.fetchone())


@router.delete("/{live_id}")
def cancel(live_id: int, request: Request, access: BoardAccess = Depends(board_access)):
    """Started by mistake: gone everywhere, nothing kept."""
    if not request.app.state.db.execute(
        "DELETE FROM live_matches WHERE id = %s AND board_id = %s", (live_id, access.id)
    ):
        raise HTTPException(status_code=404, detail="No such match being played")
    return {"cancelled": live_id}
