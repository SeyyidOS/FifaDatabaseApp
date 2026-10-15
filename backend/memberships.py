"""Who is in which board, as accounts (accounts.py) rather than devices with a board password.

An account becomes a board's owner by creating it while signed in, or by claiming an existing board
with its admin password (how the original group's board moves over). A member trades its account
token for an ordinary board token (`POST /boards/{slug}/session`), so the rest of the API stays as it
is: owners and admins get the admin role, players the member role. Like accounts, all of it is off
unless accounts are on.
"""

import math

import psycopg2.errors
from fastapi import APIRouter, Header, HTTPException, Request

from accounts import current_user
from auth import BOARD_ROLE, client_ip, failed_logins, issue_token, verify_password
from elo import board_ratings
from schemas import BoardClaim, MembershipPlayer

router = APIRouter(tags=["memberships"])

# a player gets a rank once they have played this many matches (frontend/src/lib/ranking.ts)
RANKED_GAMES = 15


def ranked_games(most_played: int) -> int:
    return min(RANKED_GAMES, math.ceil(most_played / 2))


def _board(request: Request, slug: str) -> dict:
    board = request.app.state.db.fetch_one(
        """
        SELECT id, slug, name, k_factor, admin_password_hash, member_version, admin_version
        FROM boards WHERE slug = %s
        """,
        (slug,),
    )
    if board is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


def _membership(request: Request, user_id: int, board_id: int) -> dict | None:
    return request.app.state.db.fetch_one(
        "SELECT * FROM memberships WHERE user_id = %s AND board_id = %s", (user_id, board_id)
    )


def add_owner(cur, user_id: int, board_id: int) -> None:
    """Inside a transaction: the account that created a board owns it."""
    cur.execute("INSERT INTO memberships (user_id, board_id, role) VALUES (%s, %s, 'owner')", (user_id, board_id))


def standing(request: Request, board: dict, player_id: int) -> dict:
    """A player's rating, matches and rank on a board, ranked the way the app ranks them."""
    db = request.app.state.db
    ratings = board_ratings(db, board["id"], board["k_factor"])
    rows = db.fetch_all(
        """
        SELECT p.id, p.archived_at IS NOT NULL AS archived, COUNT(mp.match_id) AS played
        FROM players p LEFT JOIN match_players mp ON mp.player_id = p.id
        WHERE p.board_id = %s GROUP BY p.id ORDER BY p.id
        """,
        (board["id"],),
    )
    active = [r for r in rows if not r["archived"]]
    need = ranked_games(max((r["played"] for r in active), default=0))
    ranked = sorted((r for r in active if r["played"] >= need), key=lambda r: -ratings.get(r["id"], 1000))
    mine = next((r for r in rows if r["id"] == player_id), None)
    return {
        "elo": round(ratings.get(player_id, 1000)),
        "played": mine["played"] if mine else 0,
        "rank": next((i + 1 for i, r in enumerate(ranked) if r["id"] == player_id), 0),
    }


@router.get("/auth/boards")
def my_boards(request: Request, authorization: str | None = Header(default=None)):
    """The boards an account is in, with its role and, once linked, its player's standing; or the player it
    asked to be, while an owner or admin hasn't answered."""
    user = current_user(request, authorization)
    rows = request.app.state.db.fetch_all(
        """
        SELECT b.id, b.slug, b.name, b.k_factor, m.role, m.player_id, p.name AS player_name,
               (SELECT COUNT(*) FROM join_requests r WHERE r.board_id = b.id) AS pending,
               jr.id AS asked, COALESCE(ap.name, jr.new_name) AS asked_name, jr.new_name IS NOT NULL AS asked_new
        FROM memberships m
        JOIN boards b ON b.id = m.board_id
        LEFT JOIN players p ON p.id = m.player_id
        LEFT JOIN join_requests jr ON jr.board_id = m.board_id AND jr.user_id = m.user_id
        LEFT JOIN players ap ON ap.id = jr.player_id
        WHERE m.user_id = %s
        ORDER BY m.created_at, b.id
        """,
        (user["id"],),
    )
    return [
        {
            "slug": r["slug"],
            "name": r["name"],
            "role": r["role"],
            # requests waiting for an owner or admin; players don't see them
            "pending": r["pending"] if r["role"] in ("owner", "admin") else 0,
            "player": None
            if r["player_id"] is None
            else {"id": r["player_id"], "name": r["player_name"], **standing(request, r, r["player_id"])},
            "asked": None if r["asked"] is None else {"name": r["asked_name"], "new": r["asked_new"]},
        }
        for r in rows
    ]


@router.post("/boards/{slug}/claim", status_code=201)
def claim(slug: str, body: BoardClaim, request: Request, authorization: str | None = Header(default=None)):
    """An account takes over a board that has no owner yet by giving its admin password."""
    user = current_user(request, authorization)
    key = f"{client_ip(request)}:{slug}"
    if failed_logins.blocked(key):
        raise HTTPException(status_code=429, detail="Too many wrong passwords; try again in a few minutes")
    board = _board(request, slug)
    if not verify_password(body.password, board["admin_password_hash"]):
        failed_logins.record(key)
        raise HTTPException(status_code=401, detail="That is not the board's admin password")
    try:
        with request.app.state.db.transaction() as cur:
            # an account already in the board (as a player, say) moves up to owner
            cur.execute("DELETE FROM memberships WHERE user_id = %s AND board_id = %s", (user["id"], board["id"]))
            add_owner(cur, user["id"], board["id"])
    except psycopg2.errors.UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="This board already has an owner") from exc
    return {"slug": board["slug"], "name": board["name"], "role": "owner"}


@router.post("/boards/{slug}/session")
def session(slug: str, request: Request, authorization: str | None = Header(default=None)):
    """A member's board token, the same kind a board password gives, for the role its membership has."""
    user = current_user(request, authorization)
    board = _board(request, slug)
    membership = _membership(request, user["id"], board["id"])
    if membership is None:
        raise HTTPException(status_code=403, detail="You are not a member of this board")
    role = BOARD_ROLE[membership["role"]]
    version = board["admin_version"] if role == "admin" else board["member_version"]
    return {
        "slug": board["slug"],
        "name": board["name"],
        "role": role,
        "token": issue_token(board["id"], role, version, user["id"]),
    }


@router.put("/boards/{slug}/membership/player")
def link_player(slug: str, body: MembershipPlayer, request: Request, authorization: str | None = Header(default=None)):
    """Owners and admins say which of the board's players they are (players will ask, with an invite)."""
    user = current_user(request, authorization)
    board = _board(request, slug)
    membership = _membership(request, user["id"], board["id"])
    if membership is None or membership["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only the board's owner and admins can do this")
    if body.playerId is not None:
        player = request.app.state.db.fetch_one(
            "SELECT id FROM players WHERE id = %s AND board_id = %s AND archived_at IS NULL",
            (body.playerId, board["id"]),
        )
        if player is None:
            raise HTTPException(status_code=404, detail="No such player on this board")
    try:
        request.app.state.db.execute(
            "UPDATE memberships SET player_id = %s WHERE user_id = %s AND board_id = %s",
            (body.playerId, user["id"], board["id"]),
        )
    except psycopg2.errors.UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="That player already belongs to another account") from exc
    return {"playerId": body.playerId}
