"""A board's seasons (FC26, FC27, ...) and the clubs, with their ratings, each one is played with.

New matches use the active season's ratings and keep them (matches.club_a_elo / club_b_elo), so
editing or replacing a club list only affects matches played afterwards.
"""

import csv
from pathlib import Path

import psycopg2.errors
from fastapi import APIRouter, Depends, HTTPException, Request
from psycopg2.extras import Json, RealDictCursor

from auth import BoardAccess, board_access, board_admin
from schemas import ClubIn, ClubUpdate, ModelApply, SeasonIn, SeasonUpdate

router = APIRouter(prefix="/boards/{slug}/seasons", tags=["seasons"])

# One CSV per game (name,elo and, for card-model games, ea_id), e.g. data/seasons/FC27.csv; new
# boards start with the newest one.
TEMPLATES = Path(__file__).parent / "data" / "seasons"


def read_template(name: str) -> list[tuple[str, int, int | None]]:
    with (TEMPLATES / f"{name}.csv").open(newline="", encoding="utf-8") as f:
        return [
            (row["name"], int(row["elo"]), int(row["ea_id"]) if row.get("ea_id") else None) for row in csv.DictReader(f)
        ]


def start_first_season(cur: RealDictCursor, board_id: int) -> None:
    name = max(path.stem for path in TEMPLATES.glob("*.csv"))
    clubs = read_template(name)
    modelled = any(ea_id for _, _, ea_id in clubs)
    cur.execute(
        "INSERT INTO seasons (board_id, name, game) VALUES (%s, %s, %s) RETURNING id",
        (board_id, name, name if modelled else None),
    )
    season_id = cur.fetchone()["id"]
    # a card-model rating counts as the model's own value, without corrections
    cur.executemany(
        "INSERT INTO season_clubs (season_id, name, elo, ea_id, model_elo) VALUES (%s, %s, %s, %s, %s)",
        [(season_id, club, elo, ea_id, elo if ea_id else None) for club, elo, ea_id in clubs],
    )
    cur.execute("UPDATE boards SET active_season_id = %s WHERE id = %s", (season_id, board_id))


def _db(request: Request):
    return request.app.state.db


SEASONS = """
SELECT s.id, s.name, s.id = b.active_season_id AS active, s.game, s.model,
       (SELECT COUNT(*) FROM matches m WHERE m.season_id = s.id) AS matches,
       COALESCE(
           JSON_AGG(
               JSON_BUILD_OBJECT(
                   'id', c.id, 'name', c.name, 'elo', c.elo,
                   'eaId', c.ea_id, 'modelElo', c.model_elo, 'adjust', c.adjust
               )
               ORDER BY c.elo DESC, c.name
           ) FILTER (WHERE c.id IS NOT NULL),
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
                "UPDATE seasons SET (game, model) = (SELECT game, model FROM seasons WHERE id = %s) WHERE id = %s",
                (body.copyFrom, season_id),
            )
            cur.execute(
                """
                INSERT INTO season_clubs (season_id, name, elo, ea_id, model_elo, adjust)
                SELECT %s, name, elo, ea_id, model_elo, adjust FROM season_clubs WHERE season_id = %s
                """,
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


@router.post("/{season_id}/model")
def apply_model(season_id: int, body: ModelApply, request: Request, access: BoardAccess = Depends(board_admin)):
    """Rate the season's clubs with a card model. Clubs are matched by EA id, then by name; an admin's
    correction on a club is kept on top of its new model rating, and clubs the model doesn't know stay
    as they are. Only a season that isn't active yet can be re-rated this way."""
    if _season(request, access.id, season_id)["active"]:
        raise HTTPException(status_code=409, detail="Only a season that isn't active can be rated by the model")
    with _db(request).transaction() as cur:
        cur.execute("SELECT id, LOWER(name) AS key, ea_id FROM season_clubs WHERE season_id = %s", (season_id,))
        existing = cur.fetchall()
        by_ea = {c["ea_id"]: c["id"] for c in existing if c["ea_id"] is not None}
        by_name = {c["key"]: c["id"] for c in existing if c["ea_id"] is None}
        try:
            for club in body.clubs:
                club_id = by_ea.get(club.eaId) or by_name.pop(club.name.lower(), None)
                if club_id is None:
                    cur.execute(
                        "INSERT INTO season_clubs (season_id, name, elo, ea_id, model_elo) VALUES (%s, %s, %s, %s, %s)",
                        (season_id, club.name, club.modelElo, club.eaId, club.modelElo),
                    )
                else:
                    cur.execute(
                        "UPDATE season_clubs SET ea_id = %s, model_elo = %s, elo = %s + adjust WHERE id = %s",
                        (club.eaId, club.modelElo, club.modelElo, club_id),
                    )
        except psycopg2.errors.UniqueViolation as exc:
            raise HTTPException(status_code=409, detail="Two clubs of this season would share a name") from exc
        cur.execute(
            "UPDATE seasons SET game = %s, model = %s WHERE id = %s", (body.game.upper(), Json(body.model), season_id)
        )
    return _season(request, access.id, season_id)


# ----------- Clubs -----------
CLUB_COLUMNS = 'id, name, elo, ea_id AS "eaId", model_elo AS "modelElo", adjust'


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
    """Matches already played keep the rating they were played with. On a model-rated club, a new
    rating is stored as a correction on top of the model's, so it survives re-running the model."""
    _season(request, access.id, season_id)
    changes = body.model_dump(exclude_none=True)
    if not changes:
        raise HTTPException(status_code=422, detail="Nothing to change")
    assignments = ", ".join(f"{column} = %({column})s" for column in changes)
    if "elo" in changes:
        assignments += ", adjust = CASE WHEN model_elo IS NULL THEN adjust ELSE %(elo)s - model_elo END"
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
