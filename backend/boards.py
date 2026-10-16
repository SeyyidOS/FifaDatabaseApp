"""Creating boards, signing in to them and changing their settings."""

import os
import secrets

import psycopg2.errors
from fastapi import APIRouter, Depends, Header, HTTPException, Request

from accounts import accounts_on, current_user
from auth import (
    BoardAccess,
    board_access,
    board_admin,
    board_creations,
    client_ip,
    failed_logins,
    hash_password,
    issue_token,
    server_admin_key_matches,
    slugify,
    verify_password,
)
from memberships import add_owner
from schemas import BoardCreate, BoardUpdate, Login
from seasons import start_first_season

router = APIRouter(prefix="/boards", tags=["boards"])


def _session(board: dict, role: str, version: int, user_id: int | None = None) -> dict:
    return {
        "slug": board["slug"],
        "name": board["name"],
        "role": role,
        "token": issue_token(board["id"], role, version, user_id),
    }


@router.post("", status_code=201)
def create_board(
    body: BoardCreate,
    request: Request,
    x_admin_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
):
    """Anyone may create a board unless BOARD_CREATION=closed (then only with the server ADMIN_KEY).

    With accounts on, a new league belongs to the signed-in account and has no passwords: people come in
    with invites. (The server ADMIN_KEY can still make one with passwords, for scripts and tests.) With
    accounts off, a board has a board password and an admin password."""
    admin_key = server_admin_key_matches(x_admin_key)
    if os.getenv("BOARD_CREATION", "open") != "open" and not admin_key:
        raise HTTPException(status_code=403, detail="Creating boards is disabled on this server")
    owner = None
    if accounts_on() and (authorization or not admin_key):
        owner = current_user(request, authorization)
    if accounts_on() and body.password is not None and not admin_key:
        raise HTTPException(status_code=422, detail="New leagues have no passwords: invite people with links")
    # without passwords, the owner's account is the only way in
    if body.password is None and owner is None:
        raise HTTPException(status_code=422, detail="A board needs a board password and an admin password")
    ip = client_ip(request)
    if board_creations.blocked(ip):
        raise HTTPException(status_code=429, detail="Too many new boards from this network; try again later")
    board_creations.record(ip)

    base = slugify(body.name)
    with request.app.state.db.transaction() as cur:
        slug = base
        for _ in range(20):
            cur.execute("SELECT 1 FROM boards WHERE slug = %s", (slug,))
            if cur.fetchone() is None:
                break
            slug = f"{base}-{secrets.token_hex(2)}"
        try:
            cur.execute(
                """
                INSERT INTO boards (slug, name, password_hash, admin_password_hash)
                VALUES (%s, %s, %s, %s) RETURNING id, slug, name, admin_version
                """,
                (
                    slug,
                    body.name,
                    body.password and hash_password(body.password),
                    body.adminPassword and hash_password(body.adminPassword),
                ),
            )
        except psycopg2.errors.UniqueViolation as exc:
            raise HTTPException(status_code=409, detail="That board name was just taken; try again") from exc
        board = cur.fetchone()
        start_first_season(cur, board["id"])
        if owner:
            add_owner(cur, owner["id"], board["id"])
    # opened with the account, a token that lasts as long as its membership (auth.board_access)
    return _session(board, "admin", board["admin_version"], owner["id"] if owner else None)


@router.get("/{slug}")
def board_public(slug: str, request: Request):
    """Just enough to show the sign-in screen: a password box, or that the league is invite-only."""
    board = request.app.state.db.fetch_one(
        "SELECT slug, name, password_hash IS NOT NULL AS password_login FROM boards WHERE slug = %s", (slug,)
    )
    if board is None:
        raise HTTPException(status_code=404, detail="Board not found")
    return {"slug": board["slug"], "name": board["name"], "passwordLogin": board["password_login"]}


@router.post("/{slug}/login")
def login(slug: str, body: Login, request: Request):
    """One password box: the admin password signs in as admin, the board password as member."""
    key = f"{client_ip(request)}:{slug}"
    if failed_logins.blocked(key):
        raise HTTPException(status_code=429, detail="Too many wrong passwords; try again in a few minutes")
    board = request.app.state.db.fetch_one(
        """
        SELECT id, slug, name, password_hash, admin_password_hash, member_version, admin_version
        FROM boards WHERE slug = %s
        """,
        (slug,),
    )
    if board is None:
        raise HTTPException(status_code=404, detail="Board not found")
    if board["password_hash"] is None:
        raise HTTPException(status_code=403, detail="This league is invite-only: sign in with your account")
    if verify_password(body.password, board["admin_password_hash"]):
        return _session(board, "admin", board["admin_version"])
    if verify_password(body.password, board["password_hash"]):
        return _session(board, "member", board["member_version"])
    failed_logins.record(key)
    raise HTTPException(status_code=401, detail="Wrong password")


@router.get("/{slug}/me")
def me(request: Request, access: BoardAccess = Depends(board_access)):
    board = request.app.state.db.fetch_one(
        "SELECT password_hash IS NOT NULL AS password_login FROM boards WHERE id = %s", (access.id,)
    )
    return {
        "slug": access.slug,
        "name": access.name,
        "role": access.role,
        "kFactor": access.k_factor,
        "clubWeight": access.club_weight,
        "passwordLogin": board["password_login"],
    }


@router.patch("/{slug}")
def update_board(body: BoardUpdate, request: Request, access: BoardAccess = Depends(board_admin)):
    """Rename, change the K-factor, the club weight or the passwords. A new password signs out that role's devices;
    when the admin password changes, the caller gets a fresh token so they stay signed in."""
    with request.app.state.db.transaction() as cur:
        cur.execute("SELECT * FROM boards WHERE id = %s FOR UPDATE", (access.id,))
        board = cur.fetchone()
        if (body.password or body.adminPassword) and board["password_hash"] is None:
            raise HTTPException(status_code=422, detail="This league has no passwords: invite people with links")
        # when both change at once, BoardUpdate already made sure they differ
        if body.password and not body.adminPassword and verify_password(body.password, board["admin_password_hash"]):
            raise HTTPException(status_code=422, detail="The board password must differ from the admin password")
        if body.adminPassword and not body.password and verify_password(body.adminPassword, board["password_hash"]):
            raise HTTPException(status_code=422, detail="The admin password must differ from the board password")

        updates: dict[str, object] = {}
        if body.name is not None:
            updates["name"] = body.name
        if body.kFactor is not None:
            updates["k_factor"] = body.kFactor
        if body.clubWeight is not None:
            updates["club_weight"] = body.clubWeight
        if body.password:
            updates["password_hash"] = hash_password(body.password)
            updates["member_version"] = board["member_version"] + 1
        if body.adminPassword:
            updates["admin_password_hash"] = hash_password(body.adminPassword)
            updates["admin_version"] = board["admin_version"] + 1
        if updates:
            assignments = ", ".join(f"{column} = %({column})s" for column in updates)
            cur.execute(
                f"UPDATE boards SET {assignments} WHERE id = %(id)s RETURNING *",
                {**updates, "id": access.id},
            )
            board = cur.fetchone()

    result = {
        "slug": board["slug"],
        "name": board["name"],
        "role": "admin",
        "kFactor": board["k_factor"],
        "clubWeight": board["club_weight"],
        "passwordLogin": board["password_hash"] is not None,
    }
    if body.adminPassword:
        result["token"] = issue_token(board["id"], "admin", board["admin_version"])
    return result
