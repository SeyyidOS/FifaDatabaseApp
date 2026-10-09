"""A board's seasons (FC26, FC27, ...) and the clubs, with their ratings, each one is played with.

New matches use the active season's ratings and keep them (matches.club_a_elo / club_b_elo), so
editing or replacing a club list only affects matches played afterwards.
"""

import csv
from pathlib import Path

import psycopg2.errors
from fastapi import APIRouter, Depends, HTTPException, Request
from psycopg2.extras import RealDictCursor

from auth import BoardAccess, board_access, board_admin
from schemas import ClubIn, ClubUpdate, SeasonIn, SeasonUpdate

router = APIRouter(prefix="/boards/{slug}/seasons", tags=["seasons"])

# One CSV (name,elo) per game, e.g. data/seasons/FC26.csv; new boards start with the newest one.
TEMPLATES = Path(__file__).parent / "data" / "seasons"


def read_template(name: str) -> list[tuple[str, int]]:
    with (TEMPLATES / f"{name}.csv").open(newline="", encoding="utf-8") as f:
        return [(row["name"], int(row["elo"])) for row in csv.DictReader(f)]


def start_first_season(cur: RealDictCursor, board_id: int) -> None:
    name = max(path.stem for path in TEMPLATES.glob("*.csv"))
    cur.execute("INSERT INTO seasons (board_id, name) VALUES (%s, %s) RETURNING id", (board_id, name))
    season_id = cur.fetchone()["id"]
    cur.executemany(
        "INSERT INTO season_clubs (season_id, name, elo) VALUES (%s, %s, %s)",
        [(season_id, club, elo) for club, elo in read_template(name)],
    )
    cur.execute("UPDATE boards SET active_season_id = %s WHERE id = %s", (season_id, board_id))


def _db(request: Request):
    return request.app.state.db


SEASONS = """
SELECT s.id, s.name, s.id = b.active_season_id AS active,
       (SELECT COUNT(*) FROM matches m WHERE m.season_id = s.id) AS matches,
       COALESCE(
           JSON_AGG(JSON_BUILD_OBJECT('id', c.id, 'name', c.name, 'elo', c.elo) ORDER BY c.elo DESC, c.name)
               FILTER (WHERE c.id IS NOT NULL),
           '[]'
       ) AS clubs
FROM seasons s
JOIN boards b ON b.id = s.board_id
LEFT JOIN season_clubs c ON c.season_id = s.id
WHERE s.board_id = %(board)s AND (%(season)s::int IS NULL OR s.id = %(season)s)
GROUP BY s.id, b.active_season_id
ORDER BY s.created_at, s.id
"""


def _season(request: Request, board_id: int, season_id: int) -> dict:
    rows = _db(request).fetch_all(SEASONS, {"board": board_id, "season": season_id})
    if not rows:
        raise HTTPException(status_code=404, detail=f"No season with ID {season_id}")
    return rows[0]


def _season_taken(name: str) -> HTTPException:
    return HTTPException(status_code=409, detail=f"There is already a season called {name}")


def _club_taken(name: str) -> HTTPException:
    return HTTPException(status_code=409, detail=f"{name} is already in this season")


# ----------- Seasons -----------
@router.get("")
def list_seasons(request: Request, access: BoardAccess = Depends(board_access)):
    """Oldest first, each with its clubs (strongest first) and how many matches were played in it."""
    return _db(request).fetch_all(SEASONS, {"board": access.id, "season": None})


@router.post("", status_code=201)
def create_season(body: SeasonIn, request: Request, access: BoardAccess = Depends(board_admin)):
    """A new, inactive season: empty, or with a copy of another season's clubs to edit."""
    if body.copyFrom is not None:
        _season(request, access.id, body.copyFrom)
    with _db(request).transaction() as cur:
        try:
            cur.execute("INSERT INTO seasons (board_id, name) VALUES (%s, %s) RETURNING id", (access.id, body.name))
        except psycopg2.errors.UniqueViolation as exc:
            raise _season_taken(body.name) from exc
        season_id = cur.fetchone()["id"]
        if body.copyFrom is not None:
            cur.execute(
                "INSERT INTO season_clubs (season_id, name, elo) SELECT %s, name, elo FROM season_clubs "
                "WHERE season_id = %s",
                (season_id, body.copyFrom),
            )
    return _season(request, access.id, season_id)


@router.patch("/{season_id}")
def update_season(season_id: int, body: SeasonUpdate, request: Request, access: BoardAccess = Depends(board_admin)):
    """Rename, or make it the active season (new matches are played with its clubs)."""
    _season(request, access.id, season_id)
    with _db(request).transaction() as cur:
        if body.name is not None:
            try:
                cur.execute("UPDATE seasons SET name = %s WHERE id = %s", (body.name, season_id))
            except psycopg2.errors.UniqueViolation as exc:
                raise _season_taken(body.name) from exc
        if body.active:
            cur.execute("UPDATE boards SET active_season_id = %s WHERE id = %s", (season_id, access.id))
    return _season(request, access.id, season_id)


@router.delete("/{season_id}")
def delete_season(season_id: int, request: Request, access: BoardAccess = Depends(board_admin)):
    """Only an inactive season nobody has played in yet (a draft or a mistake) can be deleted."""
    season = _season(request, access.id, season_id)
    if season["active"]:
        raise HTTPException(status_code=409, detail="The active season can't be deleted")
    if season["matches"]:
        raise HTTPException(status_code=409, detail=f"{season['name']} has {season['matches']} matches")
    _db(request).execute("DELETE FROM seasons WHERE id = %s", (season_id,))
    return {"message": f"Season {season['name']} deleted."}


# ----------- Clubs -----------
CLUB_COLUMNS = "id, name, elo"


@router.post("/{season_id}/clubs", status_code=201)
def add_club(season_id: int, club: ClubIn, request: Request, access: BoardAccess = Depends(board_admin)):
    _season(request, access.id, season_id)
    try:
        return _db(request).write_one(
            f"INSERT INTO season_clubs (season_id, name, elo) VALUES (%s, %s, %s) RETURNING {CLUB_COLUMNS}",
            (season_id, club.name, club.elo),
        )
    except psycopg2.errors.UniqueViolation as exc:
        raise _club_taken(club.name) from exc


@router.patch("/{season_id}/clubs/{club_id}")
def update_club(
    season_id: int, club_id: int, body: ClubUpdate, request: Request, access: BoardAccess = Depends(board_admin)
):
    """Matches already played keep the rating they were played with."""
    _season(request, access.id, season_id)
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Nothing to change")
    assignments = ", ".join(f"{column} = %({column})s" for column in changes)
    try:
        row = _db(request).write_one(
            f"UPDATE season_clubs SET {assignments} WHERE id = %(id)s AND season_id = %(season)s "
            f"RETURNING {CLUB_COLUMNS}",
            {**changes, "id": club_id, "season": season_id},
        )
    except psycopg2.errors.UniqueViolation as exc:
        raise _club_taken(body.name or "") from exc
    if row is None:
        raise HTTPException(status_code=404, detail=f"No club with ID {club_id} in this season")
    return row


@router.delete("/{season_id}/clubs/{club_id}")
def delete_club(season_id: int, club_id: int, request: Request, access: BoardAccess = Depends(board_admin)):
    """Leaves the season's list; matches already played with it are untouched."""
    _season(request, access.id, season_id)
    row = _db(request).write_one(
        "DELETE FROM season_clubs WHERE id = %s AND season_id = %s RETURNING name", (club_id, season_id)
    )
    if row is None:
        raise HTTPException(status_code=404, detail=f"No club with ID {club_id} in this season")
    return {"message": f"{row['name']} removed."}
