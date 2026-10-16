"""Invites and the people who come in with them.

Owners and admins make two kinds of links. A personal link is for one of the board's players: whoever
opens it and signs in becomes that player's account, no approval needed, since the admin chose who it
was for; it works once and for a week. The group link is one for everybody (until an admin resets it):
whoever opens it joins as a player and says which player they are, or that they are new, and an owner
or admin approves that, because anyone with the link could pick anyone.
"""

import secrets

import psycopg2.errors
from fastapi import APIRouter, Header, HTTPException, Request

from accounts import current_user
from memberships import _board, _membership, standing
from schemas import InviteAccept, InviteCreate, MemberUpdate

router = APIRouter(tags=["invites"])

PERSONAL_DAYS = 7


def _manager(request: Request, slug: str, authorization: str | None) -> tuple[dict, dict, dict]:
    """The signed-in owner or admin of a board: (user, board, membership)."""
    user = current_user(request, authorization)
    board = _board(request, slug)
    membership = _membership(request, user["id"], board["id"])
    if membership is None or membership["role"] not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Only the board's owner and admins can do this")
    return user, board, membership


def _new_code() -> str:
    return secrets.token_urlsafe(9)


def _group_invite(cur, board_id: int) -> dict:
    cur.execute("SELECT * FROM invites WHERE board_id = %s AND kind = 'group' AND revoked_at IS NULL", (board_id,))
    invite = cur.fetchone()
    if invite is None:
        cur.execute(
            "INSERT INTO invites (board_id, code, kind) VALUES (%s, %s, 'group') RETURNING *", (board_id, _new_code())
        )
        invite = cur.fetchone()
    return invite


def _linked_players(db, board_id: int) -> set[int]:
    rows = db.fetch_all("SELECT player_id FROM memberships WHERE board_id = %s AND player_id IS NOT NULL", (board_id,))
    return {r["player_id"] for r in rows}


# ------------------------------ owners and admins ------------------------------


@router.get("/boards/{slug}/invites")
def list_invites(slug: str, request: Request, authorization: str | None = Header(default=None)):
    """The group link, and for every player without an account their personal link, if they have one."""
    _, board, _ = _manager(request, slug, authorization)
    db = request.app.state.db
    group = db.fetch_one(
        "SELECT code FROM invites WHERE board_id = %s AND kind = 'group' AND revoked_at IS NULL", (board["id"],)
    )
    players = db.fetch_all(
        """
        SELECT p.id, p.name, COUNT(mp.match_id) AS played,
               (SELECT i.code FROM invites i
                WHERE i.player_id = p.id AND i.used_at IS NULL AND i.revoked_at IS NULL AND i.expires_at > NOW()
                ORDER BY i.id DESC LIMIT 1) AS code
        FROM players p LEFT JOIN match_players mp ON mp.player_id = p.id
        WHERE p.board_id = %s AND p.archived_at IS NULL
        GROUP BY p.id ORDER BY COUNT(mp.match_id) DESC, p.name
        """,
        (board["id"],),
    )
    linked = _linked_players(db, board["id"])
    return {
        "group": group["code"] if group else None,
        "players": [
            {"id": p["id"], "name": p["name"], "played": p["played"], "code": p["code"]}
            for p in players
            if p["id"] not in linked
        ],
    }


@router.post("/boards/{slug}/invites", status_code=201)
def create_invite(slug: str, body: InviteCreate, request: Request, authorization: str | None = Header(default=None)):
    """A personal link for a player (the same one again while it is still good), or the group link."""
    _, board, _ = _manager(request, slug, authorization)
    db = request.app.state.db
    with db.transaction() as cur:
        if body.playerId is None:
            return {"kind": "group", "code": _group_invite(cur, board["id"])["code"]}
        cur.execute(
            "SELECT id FROM players WHERE id = %s AND board_id = %s AND archived_at IS NULL",
            (body.playerId, board["id"]),
        )
        if cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="No such player on this board")
        cur.execute("SELECT 1 FROM memberships WHERE player_id = %s", (body.playerId,))
        if cur.fetchone():
            raise HTTPException(status_code=409, detail="That player already has an account")
        cur.execute(
            """
            SELECT code FROM invites
            WHERE player_id = %s AND used_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()
            ORDER BY id DESC LIMIT 1
            """,
            (body.playerId,),
        )
        invite = cur.fetchone()
        if invite is None:
            cur.execute(
                """
                INSERT INTO invites (board_id, code, kind, player_id, expires_at)
                VALUES (%s, %s, 'personal', %s, NOW() + %s * INTERVAL '1 day') RETURNING code
                """,
                (board["id"], _new_code(), body.playerId, PERSONAL_DAYS),
            )
            invite = cur.fetchone()
    return {"kind": "personal", "code": invite["code"]}


@router.post("/boards/{slug}/invites/group/reset", status_code=201)
def reset_group_invite(slug: str, request: Request, authorization: str | None = Header(default=None)):
    """A new group link; the old one stops working."""
    _, board, _ = _manager(request, slug, authorization)
    with request.app.state.db.transaction() as cur:
        cur.execute(
            "UPDATE invites SET revoked_at = NOW() WHERE board_id = %s AND kind = 'group' AND revoked_at IS NULL",
            (board["id"],),
        )
        return {"kind": "group", "code": _group_invite(cur, board["id"])["code"]}


@router.get("/boards/{slug}/members")
def list_members(slug: str, request: Request, authorization: str | None = Header(default=None)):
    """Who has an account in the board, and who asked to be one of its players (with their e-mail: what an
    admin can check a claim against)."""
    _, board, _ = _manager(request, slug, authorization)
    db = request.app.state.db
    members = db.fetch_all(
        """
        SELECT m.user_id, u.name, m.role, m.player_id, p.name AS player_name
        FROM memberships m JOIN users u ON u.id = m.user_id LEFT JOIN players p ON p.id = m.player_id
        WHERE m.board_id = %s
        ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, m.created_at
        """,
        (board["id"],),
    )
    requests_ = db.fetch_all(
        """
        SELECT r.id, u.name, u.email, r.player_id, p.name AS player_name, r.new_name, r.created_at
        FROM join_requests r JOIN users u ON u.id = r.user_id LEFT JOIN players p ON p.id = r.player_id
        WHERE r.board_id = %s ORDER BY r.created_at
        """,
        (board["id"],),
    )
    return {
        "members": [
            {
                "userId": m["user_id"],
                "name": m["name"],
                "role": m["role"],
                "player": {"id": m["player_id"], "name": m["player_name"]} if m["player_id"] else None,
            }
            for m in members
        ],
        "requests": [
            {
                "id": r["id"],
                "name": r["name"],
                "email": r["email"],
                "player": {"id": r["player_id"], "name": r["player_name"]} if r["player_id"] else None,
                "newName": r["new_name"],
            }
            for r in requests_
        ],
    }


@router.post("/boards/{slug}/requests/{request_id}/approve")
def approve(slug: str, request_id: int, request: Request, authorization: str | None = Header(default=None)):
    """The person becomes the player they named, or a new player with the name they gave."""
    _, board, _ = _manager(request, slug, authorization)
    try:
        with request.app.state.db.transaction() as cur:
            cur.execute(
                "DELETE FROM join_requests WHERE id = %s AND board_id = %s RETURNING *", (request_id, board["id"])
            )
            req = cur.fetchone()
            if req is None:
                raise HTTPException(status_code=404, detail="No such request")
            player_id = req["player_id"]
            if player_id is None:
                cur.execute(
                    "INSERT INTO players (board_id, name) VALUES (%s, %s) RETURNING id", (board["id"], req["new_name"])
                )
                player_id = cur.fetchone()["id"]
            cur.execute(
                """
                INSERT INTO memberships (user_id, board_id, role, player_id) VALUES (%s, %s, 'player', %s)
                ON CONFLICT (user_id, board_id) DO UPDATE SET player_id = EXCLUDED.player_id
                """,
                (req["user_id"], board["id"], player_id),
            )
    except psycopg2.errors.UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="That player already has an account, or the name is taken") from exc
    return {"playerId": player_id}


@router.post("/boards/{slug}/requests/{request_id}/reject")
def reject(slug: str, request_id: int, request: Request, authorization: str | None = Header(default=None)):
    """The person stays in the board, without a player."""
    _, board, _ = _manager(request, slug, authorization)
    if not request.app.state.db.execute(
        "DELETE FROM join_requests WHERE id = %s AND board_id = %s", (request_id, board["id"])
    ):
        raise HTTPException(status_code=404, detail="No such request")
    return {"rejected": True}


@router.patch("/boards/{slug}/members/{user_id}")
def update_member(
    slug: str, user_id: int, body: MemberUpdate, request: Request, authorization: str | None = Header(default=None)
):
    """Only the owner makes admins (and takes it back)."""
    _, board, membership = _manager(request, slug, authorization)
    if membership["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only the board's owner can change roles")
    if not request.app.state.db.execute(
        "UPDATE memberships SET role = %s WHERE board_id = %s AND user_id = %s AND role <> 'owner'",
        (body.role, board["id"], user_id),
    ):
        raise HTTPException(status_code=404, detail="No such member")
    return {"role": body.role}


@router.post("/boards/{slug}/members/{user_id}/owner")
def hand_over(slug: str, user_id: int, request: Request, authorization: str | None = Header(default=None)):
    """The owner hands the board to another member and stays on as an admin."""
    user, board, membership = _manager(request, slug, authorization)
    if membership["role"] != "owner":
        raise HTTPException(status_code=403, detail="Only the board's owner can hand it over")
    if user_id == user["id"]:
        raise HTTPException(status_code=422, detail="You own it already")
    with request.app.state.db.transaction() as cur:
        # one owner per board: step down first
        cur.execute(
            "UPDATE memberships SET role = 'admin' WHERE board_id = %s AND user_id = %s", (board["id"], user["id"])
        )
        cur.execute(
            "UPDATE memberships SET role = 'owner' WHERE board_id = %s AND user_id = %s RETURNING user_id",
            (board["id"], user_id),
        )
        if cur.fetchone() is None:
            raise HTTPException(status_code=404, detail="No such member")
    return {"owner": user_id}


@router.delete("/boards/{slug}/members/{user_id}")
def remove_member(slug: str, user_id: int, request: Request, authorization: str | None = Header(default=None)):
    """Out of the board; their player and matches stay, without an account. Admins remove players only."""
    _, board, membership = _manager(request, slug, authorization)
    roles = ("admin", "player") if membership["role"] == "owner" else ("player",)
    if not request.app.state.db.execute(
        "DELETE FROM memberships WHERE board_id = %s AND user_id = %s AND role = ANY(%s)",
        (board["id"], user_id, list(roles)),
    ):
        raise HTTPException(status_code=404, detail="No such member, or not yours to remove")
    request.app.state.db.execute(
        "DELETE FROM join_requests WHERE board_id = %s AND user_id = %s", (board["id"], user_id)
    )
    return {"removed": True}


# --------------------------------- invitees ----------------------------------


def _open_invite(request: Request, code: str) -> tuple[dict, dict]:
    db = request.app.state.db
    invite = db.fetch_one(
        """
        SELECT * FROM invites
        WHERE code = %s AND used_at IS NULL AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())
        """,
        (code,),
    )
    if invite is None:
        raise HTTPException(status_code=404, detail="This invite is used, expired or was replaced")
    board = db.fetch_one("SELECT id, slug, name, k_factor FROM boards WHERE id = %s", (invite["board_id"],))
    return invite, board


@router.get("/invites/{code}")
def preview(code: str, request: Request):
    """What the link leads to, before signing in: the board and, for a personal link, who it is for."""
    invite, board = _open_invite(request, code)
    db = request.app.state.db
    counts = db.fetch_one(
        """
        SELECT (SELECT COUNT(*) FROM players WHERE board_id = %(b)s AND archived_at IS NULL) AS players,
               (SELECT COUNT(*) FROM matches WHERE board_id = %(b)s) AS matches
        """,
        {"b": board["id"]},
    )
    out: dict = {"kind": invite["kind"], "board": {"name": board["name"], **counts}}
    if invite["kind"] == "personal":
        player = db.fetch_one("SELECT id, name FROM players WHERE id = %s", (invite["player_id"],))
        out["player"] = {**player, **standing(request, board, player["id"])}
    else:
        linked = _linked_players(db, board["id"])
        players = db.fetch_all(
            """
            SELECT p.id, p.name, COUNT(mp.match_id) AS played
            FROM players p LEFT JOIN match_players mp ON mp.player_id = p.id
            WHERE p.board_id = %s AND p.archived_at IS NULL
            GROUP BY p.id ORDER BY COUNT(mp.match_id) DESC, p.name
            """,
            (board["id"],),
        )
        out["players"] = [p for p in players if p["id"] not in linked]
    return out


@router.post("/invites/{code}/accept")
def accept(code: str, body: InviteAccept, request: Request, authorization: str | None = Header(default=None)):
    """Joins the board. A personal link makes you its player at once; by the group link you join as a player and,
    if you said who you are, ask an owner or admin to confirm it."""
    user = current_user(request, authorization)
    invite, board = _open_invite(request, code)
    try:
        with request.app.state.db.transaction() as cur:
            if invite["kind"] == "personal":
                cur.execute("UPDATE invites SET used_at = NOW() WHERE id = %s AND used_at IS NULL", (invite["id"],))
                if cur.rowcount == 0:
                    raise HTTPException(status_code=404, detail="This invite is used, expired or was replaced")
                cur.execute(
                    """
                    INSERT INTO memberships (user_id, board_id, role, player_id) VALUES (%s, %s, 'player', %s)
                    ON CONFLICT (user_id, board_id) DO UPDATE SET player_id = EXCLUDED.player_id
                    """,
                    (user["id"], board["id"], invite["player_id"]),
                )
                cur.execute("DELETE FROM join_requests WHERE board_id = %s AND user_id = %s", (board["id"], user["id"]))
                return {"slug": board["slug"], "status": "joined"}

            cur.execute(
                """
                INSERT INTO memberships (user_id, board_id, role) VALUES (%s, %s, 'player')
                ON CONFLICT (user_id, board_id) DO NOTHING
                """,
                (user["id"], board["id"]),
            )
            if body.playerId is None and body.newName is None:
                return {"slug": board["slug"], "status": "joined"}
            if body.playerId is not None:
                cur.execute(
                    """
                    SELECT 1 FROM players p WHERE p.id = %s AND p.board_id = %s AND p.archived_at IS NULL
                    AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.player_id = p.id)
                    """,
                    (body.playerId, board["id"]),
                )
                if cur.fetchone() is None:
                    raise HTTPException(status_code=409, detail="That player is not free to pick")
            cur.execute(
                """
                INSERT INTO join_requests (board_id, user_id, player_id, new_name) VALUES (%s, %s, %s, %s)
                ON CONFLICT (board_id, user_id) DO UPDATE
                SET player_id = EXCLUDED.player_id, new_name = EXCLUDED.new_name, created_at = NOW()
                """,
                (board["id"], user["id"], body.playerId, body.newName),
            )
    except psycopg2.errors.UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="That player already has an account") from exc
    return {"slug": board["slug"], "status": "requested"}
