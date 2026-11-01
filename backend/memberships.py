"""Who is in which board, as accounts (accounts.py) rather than devices with a board password.

An account becomes a board's owner by creating it while signed in, or by claiming an existing board
with its admin password (how the original group's board moves over). A member trades its account
token for an ordinary board token (`POST /boards/{slug}/session`), so the rest of the API stays as it
is: owners and admins get the admin role, players the member role. Like accounts, all of it is off
unless accounts are on.
"""

import math
import os

import psycopg2.errors
from fastapi import APIRouter, Header, HTTPException, Request

from accounts import current_user
from auth import board_role, client_ip, failed_logins, issue_token, verify_password
from avatars import _remove as remove_avatar
from elo import compute_ratings
from photos import remove_files
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
    """A player's rating and rank on a board (ranked the way the app ranks them), record, last five results
    (oldest first) and their latest match night: the day it began, its record and the Elo it won or lost.
    A night runs past midnight: like the app, its day is the local date six hours earlier."""
    db = request.app.state.db
    players = db.fetch_all(
        "SELECT id, archived_at IS NOT NULL AS archived FROM players WHERE board_id = %s ORDER BY id", (board["id"],)
    )
    matches = db.fetch_all(
        """
        SELECT m.club_a_elo, m.club_b_elo, m.club_weight, m.score_a, m.score_b,
               (((m.time AT TIME ZONE 'UTC') AT TIME ZONE %(tz)s) - INTERVAL '6 hours')::date AS night,
               ARRAY_AGG(mp.player_id ORDER BY mp.slot) FILTER (WHERE mp.side = 'A') AS team_a,
               ARRAY_AGG(mp.player_id ORDER BY mp.slot) FILTER (WHERE mp.side = 'B') AS team_b
        FROM matches m LEFT JOIN match_players mp ON mp.match_id = m.id
        WHERE m.board_id = %(board)s
        GROUP BY m.id ORDER BY m.time, m.id
        """,
        {"tz": os.getenv("APP_TIMEZONE", "Europe/Istanbul"), "board": board["id"]},
    )
    ids = [p["id"] for p in players]
    ratings = compute_ratings(ids, matches, board["k_factor"])

    played: dict[int, int] = {}
    results = []  # this player's, oldest first: (night, result, goals for)
    for m in matches:
        for pid in (m["team_a"] or []) + (m["team_b"] or []):
            played[pid] = played.get(pid, 0) + 1
        side = "A" if player_id in (m["team_a"] or []) else "B" if player_id in (m["team_b"] or []) else None
        if side:
            mine, theirs = (m["score_a"], m["score_b"]) if side == "A" else (m["score_b"], m["score_a"])
            results.append((m["night"], "W" if mine > theirs else "D" if mine == theirs else "L", mine))

    active = [p for p in players if not p["archived"]]
    need = ranked_games(max((played.get(p["id"], 0) for p in active), default=0))
    ranked = sorted((p for p in active if played.get(p["id"], 0) >= need), key=lambda p: -ratings.get(p["id"], 1000))
    last_night = None
    if results:
        night = results[-1][0]
        tonight = [r for n, r, _ in results if n == night]
        before = compute_ratings(ids, [m for m in matches if m["night"] < night], board["k_factor"])
        last_night = {
            "day": night.isoformat(),
            "played": len(tonight),
            "wins": tonight.count("W"),
            "draws": tonight.count("D"),
            "losses": tonight.count("L"),
            "delta": ratings.get(player_id, 1000) - before.get(player_id, 1000),
        }
    outcomes = [r for _, r, _ in results]
    return {
        "elo": round(ratings.get(player_id, 1000)),
        "played": len(results),
        "rank": next((i + 1 for i, p in enumerate(ranked) if p["id"] == player_id), 0),
        "wins": outcomes.count("W"),
        "draws": outcomes.count("D"),
        "losses": outcomes.count("L"),
        "goals": sum(g for _, _, g in results),
        "form": outcomes[-5:],
        "lastNight": last_night,
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
    role = board_role(membership)
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


@router.delete("/boards/{slug}/membership")
def leave(slug: str, request: Request, authorization: str | None = Header(default=None)):
    """Leaves a board, as when an owner or admin removes you: your player and matches stay, without your
    account. Its owner hands it over first."""
    user = current_user(request, authorization)
    board = _board(request, slug)
    membership = _membership(request, user["id"], board["id"])
    if membership is None:
        raise HTTPException(status_code=404, detail="You are not a member of this board")
    if membership["role"] == "owner":
        raise HTTPException(status_code=409, detail="Hand the league over to someone before you leave it")
    with request.app.state.db.transaction() as cur:
        cur.execute("DELETE FROM memberships WHERE user_id = %s AND board_id = %s", (user["id"], board["id"]))
        cur.execute("DELETE FROM join_requests WHERE user_id = %s AND board_id = %s", (user["id"], board["id"]))
    return {"left": True}


# --------------------------------- leaving for good ----------------------------------

# Each of an account's boards and, for one it owns, who takes it over: an admin first, then a member with
# a player, longest in first; never someone whose request to join is still unanswered.
_LEAVING = """
SELECT b.id, b.slug, b.name, m.role, b.password_hash IS NOT NULL AS passwords,
       h.user_id AS heir, COALESCE(hu.name, hp.name) AS heir_name
FROM memberships m
JOIN boards b ON b.id = m.board_id
LEFT JOIN LATERAL (
    SELECT o.user_id, o.player_id FROM memberships o
    WHERE o.board_id = m.board_id AND o.user_id <> m.user_id
      AND NOT EXISTS (SELECT 1 FROM join_requests r WHERE r.board_id = o.board_id AND r.user_id = o.user_id)
    ORDER BY o.role = 'admin' DESC, o.player_id IS NOT NULL DESC, o.created_at, o.user_id
    LIMIT 1
) h ON m.role = 'owner'
LEFT JOIN users hu ON hu.id = h.user_id
LEFT JOIN players hp ON hp.id = h.player_id
WHERE m.user_id = %s
ORDER BY m.created_at, b.id
"""


def _fate(row: dict) -> str:
    """What deleting the account does to one of its boards. One it owns passes to the heir; with nobody to
    take it, a board people open with its passwords stays, ownerless (its admin password claims it again),
    and one only the account could open goes with it."""
    if row["role"] != "owner":
        return "leave"
    if row["heir"] is not None:
        return "handover"
    return "keep" if row["passwords"] else "delete"


@router.get("/auth/me/deletion")
def deletion_preview(request: Request, authorization: str | None = Header(default=None)):
    """What deleting this account would do to each of its boards, for the app to say before it is done."""
    user = current_user(request, authorization)
    rows = request.app.state.db.fetch_all(_LEAVING, (user["id"],))
    return [{"slug": r["slug"], "name": r["name"], "fate": _fate(r), "heir": r["heir_name"]} for r in rows]


@router.delete("/auth/me", status_code=204)
def delete_account(request: Request, authorization: str | None = Header(default=None)):
    """Deletes the account: its e-mail, name and photo, its memberships and its sign-in links. Boards it
    owns go as deletion_preview says. Its players and their matches stay with their boards, as when a
    member is removed; who logged or changed a match is forgotten."""
    user = current_user(request, authorization)
    files: list[str] = []
    with request.app.state.db.transaction() as cur:
        cur.execute("SELECT id FROM users WHERE id = %s FOR UPDATE", (user["id"],))
        cur.execute(_LEAVING, (user["id"],))
        for row in cur.fetchall():
            fate = _fate(row)
            if fate == "handover":
                # one owner per board: this membership goes before the heir moves up
                cur.execute("DELETE FROM memberships WHERE user_id = %s AND board_id = %s", (user["id"], row["id"]))
                cur.execute(
                    "UPDATE memberships SET role = 'owner' WHERE user_id = %s AND board_id = %s",
                    (row["heir"], row["id"]),
                )
            elif fate == "delete":
                cur.execute(
                    "SELECT p.file FROM match_photos p JOIN matches m ON m.id = p.match_id WHERE m.board_id = %s",
                    (row["id"],),
                )
                files += [r["file"] for r in cur.fetchall()]
                # matches first: their players are only let go once no match names them
                cur.execute("DELETE FROM matches WHERE board_id = %s", (row["id"],))
                cur.execute("DELETE FROM boards WHERE id = %s", (row["id"],))
        cur.execute("DELETE FROM login_links WHERE email = %s", (user["email"],))
        cur.execute("DELETE FROM users WHERE id = %s", (user["id"],))
    remove_avatar(user["photo"])
    remove_files(files)
