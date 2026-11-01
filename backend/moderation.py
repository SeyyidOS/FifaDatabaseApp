"""Keeping people safe from each other, as App Review asks of apps where people post (guideline 1.2).

- Terms: every account agrees to the terms of use, which allow no offensive content or abuse
  (accounts.accept_terms).
- Filtering: names others will see can't hold slurs or obscenities (wordfilter.py).
- Reporting: anyone in a league can report a photo or a player (their name or photo). A report is kept here
  and mailed to SUPPORT_EMAIL, and the operator acts on it within a day: deploy/moderate.py lists reports,
  removes photos and suspends accounts through the /admin routes below, with the server's ADMIN_KEY.
- Blocking: an account can block the account behind a player; that account's photos (its own picture and
  the match photos it adds) are then hidden from it, wherever they play together. Matches stay: a league's
  results are everyone's. A league's owner and admins can also remove someone and keep them out
  (invites.remove_member), and anyone but the owner can leave a league (memberships.leave).
"""

import logging
import os

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request

import mailer
from accounts import current_user
from auth import BoardAccess, RateLimiter, board_reader, client_ip, server_admin_key_matches
from schemas import ReportIn, ReportResolve

router = APIRouter(tags=["moderation"])
log = logging.getLogger("fifa.moderation")

# reports one address may send in an hour: enough for a bad night, not enough to flood the inbox
reports_per_ip = RateLimiter(limit=20, window=3600)

REASONS = {
    "offensive": "offensive or inappropriate",
    "harassment": "harassment or bullying",
    "impersonation": "pretending to be someone",
    "other": "something else",
}


def _db(request: Request):
    return request.app.state.db


def _target(request: Request, board_id: int, kind: str, target_id: int) -> tuple[int | None, str]:
    """The account behind what was reported (if any), and what it is, in words, for the report."""
    if kind == "photo":
        row = _db(request).fetch_one(
            """
            SELECT ph.match_id, ph.uploaded_by FROM match_photos ph JOIN matches m ON m.id = ph.match_id
            WHERE ph.id = %s AND m.board_id = %s
            """,
            (target_id, board_id),
        )
        if row is None:
            raise HTTPException(status_code=404, detail=f"No photo with ID {target_id}")
        return row["uploaded_by"], f"photo {target_id} of match {row['match_id']}"
    row = _db(request).fetch_one(
        """
        SELECT p.name, m.user_id FROM players p LEFT JOIN memberships m ON m.player_id = p.id
        WHERE p.id = %s AND p.board_id = %s
        """,
        (target_id, board_id),
    )
    if row is None:
        raise HTTPException(status_code=404, detail=f"No player with ID {target_id}")
    return row["user_id"], f"player {row['name']!r}"


@router.post("/boards/{slug}/reports", status_code=201)
def report(body: ReportIn, request: Request, tasks: BackgroundTasks, access: BoardAccess = Depends(board_reader)):
    """Flags a photo or a player to the people who run the app; the reporter stays unnamed to everyone else."""
    ip = client_ip(request)
    if reports_per_ip.blocked(ip):
        raise HTTPException(status_code=429, detail="Too many reports; try again in a while")
    target_user, subject = _target(request, access.id, body.kind, body.targetId)
    reports_per_ip.record(ip)
    row = _db(request).write_one(
        """
        INSERT INTO reports (board_id, reporter_id, kind, target_id, target_user_id, subject, reason, note)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """,
        (access.id, access.user_id, body.kind, body.targetId, target_user, subject, body.reason, body.note),
    )
    to = os.getenv("SUPPORT_EMAIL", "").strip()
    if to:
        fields = {
            "id": row["id"],
            "subject": subject,
            "board": access.name,
            "slug": access.slug,
            "reason": REASONS[body.reason],
            "note": body.note or "-",
            "account": target_user if target_user is not None else "none",
        }
        tasks.add_task(mailer.send_mail_later, "report", to, "en", **fields)
    else:
        log.warning("report %s on %s: no SUPPORT_EMAIL to tell", row["id"], access.slug)
    return {"id": row["id"]}


# ------------------------------- blocking -------------------------------


def _player_account(request: Request, access: BoardAccess, player_id: int) -> int:
    """The account behind a player of this board, for the signed-in account to block or unblock."""
    if access.user_id is None:
        raise HTTPException(status_code=403, detail="Sign in with your account to block someone")
    row = _db(request).fetch_one(
        """
        SELECT m.user_id FROM players p LEFT JOIN memberships m ON m.player_id = p.id
        WHERE p.id = %s AND p.board_id = %s
        """,
        (player_id, access.id),
    )
    if row is None:
        raise HTTPException(status_code=404, detail=f"No player with ID {player_id}")
    if row["user_id"] is None:
        raise HTTPException(status_code=404, detail="This player has no account to block")
    if row["user_id"] == access.user_id:
        raise HTTPException(status_code=422, detail="That's you")
    return row["user_id"]


@router.put("/boards/{slug}/players/{player_id}/block")
def block(player_id: int, request: Request, access: BoardAccess = Depends(board_reader)):
    """Hides the photos of the account behind this player from the signed-in account, in every league."""
    blocked = _player_account(request, access, player_id)
    _db(request).execute(
        "INSERT INTO user_blocks (user_id, blocked_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
        (access.user_id, blocked),
    )
    return {"blocked": True}


@router.delete("/boards/{slug}/players/{player_id}/block")
def unblock_player(player_id: int, request: Request, access: BoardAccess = Depends(board_reader)):
    blocked = _player_account(request, access, player_id)
    _db(request).execute("DELETE FROM user_blocks WHERE user_id = %s AND blocked_id = %s", (access.user_id, blocked))
    return {"blocked": False}


@router.get("/auth/me/blocks")
def my_blocks(request: Request, authorization: str | None = Header(default=None)):
    """Whom the account blocked, by the name they go by in a league they share (or their account's name)."""
    user = current_user(request, authorization)
    return _db(request).fetch_all(
        """
        SELECT b.blocked_id AS "userId",
               COALESCE(
                   (SELECT p.name FROM memberships m JOIN players p ON p.id = m.player_id
                    WHERE m.user_id = b.blocked_id ORDER BY m.created_at LIMIT 1),
                   u.name
               ) AS name
        FROM user_blocks b JOIN users u ON u.id = b.blocked_id
        WHERE b.user_id = %s ORDER BY b.created_at
        """,
        (user["id"],),
    )


@router.delete("/auth/me/blocks/{user_id}")
def unblock(user_id: int, request: Request, authorization: str | None = Header(default=None)):
    user = current_user(request, authorization)
    if not _db(request).execute(
        "DELETE FROM user_blocks WHERE user_id = %s AND blocked_id = %s", (user["id"], user_id)
    ):
        raise HTTPException(status_code=404, detail="You haven't blocked them")
    return {"blocked": False}


# ------------------------------- the operator -------------------------------


def operator(x_admin_key: str | None = Header(default=None)) -> None:
    """Whoever runs the server, with its ADMIN_KEY (deploy/moderate.py)."""
    if not server_admin_key_matches(x_admin_key):
        raise HTTPException(status_code=403, detail="Only the server's operator can do this")


@router.get("/admin/reports", dependencies=[Depends(operator)])
def list_reports(request: Request, all: bool = False):
    """Open reports, oldest first (all of them, newest first, with ?all=true)."""
    return _db(request).fetch_all(
        f"""
        SELECT r.id, r.created_at AS "createdAt", b.slug AS board, r.kind, r.target_id AS "targetId",
               r.subject, r.reason, r.note, r.target_user_id AS "accountId",
               tu.name AS "accountName", tu.email AS "accountEmail", tu.banned_at IS NOT NULL AS suspended,
               r.reporter_id AS "reporterId", r.resolved_at AS "resolvedAt", r.resolution
        FROM reports r JOIN boards b ON b.id = r.board_id LEFT JOIN users tu ON tu.id = r.target_user_id
        {"" if all else "WHERE r.resolved_at IS NULL"}
        ORDER BY r.created_at {"DESC" if all else "ASC"}
        """
    )


@router.post("/admin/reports/{report_id}/resolve", dependencies=[Depends(operator)])
def resolve_report(report_id: int, body: ReportResolve, request: Request):
    if not _db(request).execute(
        "UPDATE reports SET resolved_at = NOW(), resolution = %s WHERE id = %s", (body.resolution, report_id)
    ):
        raise HTTPException(status_code=404, detail=f"No report with ID {report_id}")
    return {"resolved": report_id}


@router.put("/admin/users/{user_id}/suspension", dependencies=[Depends(operator)])
def suspend(user_id: int, request: Request):
    """Puts an account out of the app: it is signed out everywhere and can't sign in or open its leagues, and
    its picture is hidden. Its leagues, players and matches stay as they are, so lifting it undoes it."""
    if not _db(request).execute(
        "UPDATE users SET banned_at = COALESCE(banned_at, NOW()), session_version = session_version + 1 WHERE id = %s",
        (user_id,),
    ):
        raise HTTPException(status_code=404, detail=f"No account with ID {user_id}")
    return {"suspended": user_id}


@router.delete("/admin/users/{user_id}/suspension", dependencies=[Depends(operator)])
def lift_suspension(user_id: int, request: Request):
    if not _db(request).execute("UPDATE users SET banned_at = NULL WHERE id = %s", (user_id,)):
        raise HTTPException(status_code=404, detail=f"No account with ID {user_id}")
    return {"suspended": None}
