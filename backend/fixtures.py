"""A board's plan for the night: who plays with and against whom, in order. One plan is open at a time;
anyone signed in to the board may make, replace or close it. A recorded match ticks off the first
unplayed planned match with the same two sides."""

import psycopg2.errors
from fastapi import APIRouter, Depends, HTTPException, Request
from psycopg2.extras import Json, RealDictCursor

from auth import BoardAccess, board_access
from schemas import FixtureIn, FixtureMatchUpdate

router = APIRouter(prefix="/boards/{slug}/fixture", tags=["fixture"])


def _db(request: Request):
    return request.app.state.db


def _open_fixture(cur: RealDictCursor, board_id: int) -> dict | None:
    cur.execute(
        'SELECT id, created_at AS "createdAt", rules FROM fixtures WHERE board_id = %s AND closed_at IS NULL',
        (board_id,),
    )
    fixture = cur.fetchone()
    if fixture is None:
        return None
    cur.execute(
        """
        SELECT fm.slot, fm.match_id AS "matchId", fm.skipped,
               ARRAY(SELECT p.name FROM UNNEST(fm.team_a) WITH ORDINALITY AS t (id, n)
                     JOIN players p ON p.id = t.id ORDER BY t.n) AS "teamA",
               ARRAY(SELECT p.name FROM UNNEST(fm.team_b) WITH ORDINALITY AS t (id, n)
                     JOIN players p ON p.id = t.id ORDER BY t.n) AS "teamB"
        FROM fixture_matches fm
        WHERE fm.fixture_id = %s
        ORDER BY fm.slot
        """,
        (fixture["id"],),
    )
    return {**fixture, "matches": cur.fetchall()}


@router.get("")
def current_fixture(request: Request, access: BoardAccess = Depends(board_access)):
    """The open plan, or null."""
    with _db(request).cursor() as cur:
        return _open_fixture(cur, access.id)


@router.put("")
def replace_fixture(body: FixtureIn, request: Request, access: BoardAccess = Depends(board_access)):
    """Start a new plan; the open one (if any) is closed."""
    names = sorted({n for m in body.matches for n in m.teamA + m.teamB})
    with _db(request).transaction() as cur:
        cur.execute(
            "SELECT id, name, archived_at IS NOT NULL AS archived FROM players WHERE board_id = %s AND name = ANY(%s)",
            (access.id, names),
        )
        found = {r["name"]: r for r in cur.fetchall()}
        unknown = [n for n in names if n not in found or found[n]["archived"]]
        if unknown:
            raise HTTPException(status_code=422, detail=f"Not on the roster: {', '.join(unknown)}")
        cur.execute("UPDATE fixtures SET closed_at = NOW() WHERE board_id = %s AND closed_at IS NULL", (access.id,))
        try:
            cur.execute(
                "INSERT INTO fixtures (board_id, rules) VALUES (%s, %s) RETURNING id", (access.id, Json(body.rules))
            )
        except psycopg2.errors.UniqueViolation as exc:
            raise HTTPException(status_code=409, detail="Someone else just made a plan; reload to see it") from exc
        fixture_id = cur.fetchone()["id"]
        cur.executemany(
            "INSERT INTO fixture_matches (fixture_id, slot, team_a, team_b) VALUES (%s, %s, %s, %s)",
            [
                (fixture_id, slot, [found[n]["id"] for n in m.teamA], [found[n]["id"] for n in m.teamB])
                for slot, m in enumerate(body.matches)
            ],
        )
        return _open_fixture(cur, access.id)


@router.delete("")
def close_fixture(request: Request, access: BoardAccess = Depends(board_access)):
    if not _db(request).execute(
        "UPDATE fixtures SET closed_at = NOW() WHERE board_id = %s AND closed_at IS NULL", (access.id,)
    ):
        raise HTTPException(status_code=404, detail="There is no plan to close")
    return {"message": "Plan closed."}


@router.patch("/matches/{slot}")
def update_planned_match(
    slot: int, body: FixtureMatchUpdate, request: Request, access: BoardAccess = Depends(board_access)
):
    """Skip a planned match (or bring it back)."""
    with _db(request).transaction() as cur:
        cur.execute(
            """
            UPDATE fixture_matches fm SET skipped = %s
            FROM fixtures f
            WHERE f.id = fm.fixture_id AND f.board_id = %s AND f.closed_at IS NULL AND fm.slot = %s
            """,
            (body.skipped, access.id, slot),
        )
        if not cur.rowcount:
            raise HTTPException(status_code=404, detail=f"The plan has no match {slot}")
        return _open_fixture(cur, access.id)


def tick_off(cur: RealDictCursor, board_id: int, match_id: int, team_a: list[int], team_b: list[int]) -> None:
    """Link a recorded match to the first open, unplayed, unskipped planned match with the same sides."""
    sides = {frozenset(team_a), frozenset(team_b)}
    cur.execute(
        """
        SELECT fm.fixture_id, fm.slot, fm.team_a, fm.team_b
        FROM fixture_matches fm JOIN fixtures f ON f.id = fm.fixture_id
        WHERE f.board_id = %s AND f.closed_at IS NULL AND fm.match_id IS NULL AND NOT fm.skipped
        ORDER BY fm.slot
        """,
        (board_id,),
    )
    for planned in cur.fetchall():
        if {frozenset(planned["team_a"]), frozenset(planned["team_b"])} == sides:
            cur.execute(
                "UPDATE fixture_matches SET match_id = %s WHERE fixture_id = %s AND slot = %s",
                (match_id, planned["fixture_id"], planned["slot"]),
            )
            return
