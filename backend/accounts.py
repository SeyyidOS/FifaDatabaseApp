"""Accounts: people who sign in with a one-time link sent to their e-mail, no password.

This is the first step towards boards that people join with their own account; boards still use their
passwords for now. The whole thing is off unless ACCOUNTS=on, APP_URL is set (the address the links in
the e-mails point to; never taken from the request, or anyone could have a link to their own site mailed
to someone else) and mail can go out (see mailer.py).
"""

import hashlib
import os
import secrets

import psycopg2.errors
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request

import mailer
from auth import client_ip, failed_logins, issue_user_token, links_per_email, links_per_ip, read_user_token
from schemas import AccountUpdate, LinkRequest, LinkVerify

router = APIRouter(prefix="/auth", tags=["accounts"])

LINK_MINUTES = 15


def accounts_on() -> bool:
    return os.getenv("ACCOUNTS") == "on" and bool(os.getenv("APP_URL")) and mailer.can_send()


def _require_accounts() -> None:
    if not accounts_on():
        raise HTTPException(status_code=404, detail="Accounts are not available on this server")


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _public(user: dict) -> dict:
    return {"id": user["id"], "email": user["email"], "name": user["name"], "photo": user["photo"]}


def current_user(request: Request, authorization: str | None) -> dict:
    _require_accounts()
    token = authorization[7:] if authorization and authorization.lower().startswith("bearer ") else None
    payload = read_user_token(token) if token else None
    if payload is None:
        raise HTTPException(status_code=401, detail="Sign in first")
    user = request.app.state.db.fetch_one("SELECT * FROM users WHERE id = %s", (payload["u"],))
    if user is None or user["session_version"] != payload["v"]:
        raise HTTPException(status_code=401, detail="Sign in again")
    return user


@router.get("/config")
def config():
    """Whether this server offers accounts, so the app knows whether to show sign-in."""
    return {"accounts": accounts_on()}


@router.post("/email", status_code=202)
def request_link(body: LinkRequest, request: Request, tasks: BackgroundTasks):
    """Mails a sign-in link. The answer is the same whether or not the address has an account."""
    _require_accounts()
    ip = client_ip(request)
    if links_per_ip.blocked(ip) or links_per_email.blocked(body.email):
        raise HTTPException(status_code=429, detail="Too many sign-in links; try again in a while")
    links_per_ip.record(ip)
    links_per_email.record(body.email)

    token = secrets.token_urlsafe(32)
    # links are worthless a few minutes after they are made: keep the table small
    request.app.state.db.execute("DELETE FROM login_links WHERE expires_at < NOW() - INTERVAL '1 day'")
    request.app.state.db.execute(
        "INSERT INTO login_links (token_hash, email, expires_at) VALUES (%s, %s, NOW() + %s * INTERVAL '1 minute')",
        (_hash(token), body.email, LINK_MINUTES),
    )
    link = f"{os.environ['APP_URL'].rstrip('/')}/#/signin?token={token}"
    tasks.add_task(mailer.send_login_link, body.email, link, body.lang, LINK_MINUTES)
    return {"sent": True}


@router.post("/email/verify")
def verify_link(body: LinkVerify, request: Request):
    """Trades a link's token for an account token; the account is created on its first sign-in."""
    _require_accounts()
    key = f"verify:{client_ip(request)}"
    if failed_logins.blocked(key):
        raise HTTPException(status_code=429, detail="Too many invalid links; try again in a few minutes")
    with request.app.state.db.transaction() as cur:
        cur.execute(
            """
            UPDATE login_links SET used_at = NOW()
            WHERE token_hash = %s AND used_at IS NULL AND expires_at > NOW()
            RETURNING email
            """,
            (_hash(body.token),),
        )
        link = cur.fetchone()
        if link is None:
            failed_logins.record(key)
            raise HTTPException(status_code=400, detail="This sign-in link is invalid, used or expired")
        cur.execute(
            """
            INSERT INTO users (email, last_login_at) VALUES (%s, NOW())
            ON CONFLICT (email) DO UPDATE SET last_login_at = NOW()
            RETURNING *
            """,
            (link["email"],),
        )
        user = cur.fetchone()
    return {"token": issue_user_token(user["id"], user["session_version"]), "user": _public(user)}


@router.get("/me")
def me(request: Request, authorization: str | None = Header(default=None)):
    return _public(current_user(request, authorization))


@router.patch("/me")
def update_me(body: AccountUpdate, request: Request, authorization: str | None = Header(default=None)):
    user = current_user(request, authorization)
    updated = request.app.state.db.write_one(
        "UPDATE users SET name = %s WHERE id = %s RETURNING *", (body.name, user["id"])
    )
    return _public(updated)


@router.post("/me/email", status_code=202)
def request_email_change(
    body: LinkRequest, request: Request, tasks: BackgroundTasks, authorization: str | None = Header(default=None)
):
    """Mails a link to the new address; the account moves there, leagues and all, once it is opened."""
    user = current_user(request, authorization)
    if body.email == user["email"]:
        raise HTTPException(status_code=422, detail="That is already your address")
    ip = client_ip(request)
    if links_per_ip.blocked(ip) or links_per_email.blocked(body.email):
        raise HTTPException(status_code=429, detail="Too many links; try again in a while")
    links_per_ip.record(ip)
    links_per_email.record(body.email)
    db = request.app.state.db
    if db.fetch_one("SELECT 1 FROM users WHERE email = %s", (body.email,)):
        raise HTTPException(status_code=409, detail="That address already has an account")

    token = secrets.token_urlsafe(32)
    # one change at a time: a new request replaces the one before
    db.execute("DELETE FROM email_changes WHERE user_id = %s OR expires_at < NOW() - INTERVAL '1 day'", (user["id"],))
    db.execute(
        """
        INSERT INTO email_changes (user_id, email, lang, token_hash, expires_at)
        VALUES (%s, %s, %s, %s, NOW() + %s * INTERVAL '1 minute')
        """,
        (user["id"], body.email, body.lang, _hash(token), LINK_MINUTES),
    )
    link = f"{os.environ['APP_URL'].rstrip('/')}/#/email?token={token}"
    tasks.add_task(mailer.send_mail, "change", body.email, body.lang, link=link, minutes=LINK_MINUTES)
    return {"sent": True}


@router.post("/me/email/verify")
def verify_email_change(body: LinkVerify, request: Request, tasks: BackgroundTasks):
    """Moves the account to the new address (opening the link proved it is yours) and signs this device in
    with it, wherever the link was opened. The old address is told."""
    _require_accounts()
    key = f"verify:{client_ip(request)}"
    if failed_logins.blocked(key):
        raise HTTPException(status_code=429, detail="Too many invalid links; try again in a few minutes")
    try:
        with request.app.state.db.transaction() as cur:
            cur.execute(
                """
                UPDATE email_changes SET used_at = NOW()
                WHERE token_hash = %s AND used_at IS NULL AND expires_at > NOW()
                RETURNING user_id, email, lang
                """,
                (_hash(body.token),),
            )
            change = cur.fetchone()
            if change is None:
                failed_logins.record(key)
                raise HTTPException(status_code=400, detail="This link is invalid, used or expired")
            cur.execute("SELECT email FROM users WHERE id = %s FOR UPDATE", (change["user_id"],))
            old = cur.fetchone()
            if old is None:
                raise HTTPException(status_code=400, detail="This link is invalid, used or expired")
            cur.execute(
                "UPDATE users SET email = %s, last_login_at = NOW() WHERE id = %s RETURNING *",
                (change["email"], change["user_id"]),
            )
            user = cur.fetchone()
    except psycopg2.errors.UniqueViolation as exc:
        raise HTTPException(status_code=409, detail="That address already has an account") from exc
    tasks.add_task(mailer.send_mail, "changed", old["email"], change["lang"], email=user["email"])
    return {"token": issue_user_token(user["id"], user["session_version"]), "user": _public(user)}
