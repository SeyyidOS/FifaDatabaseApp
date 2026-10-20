"""Accounts: people who sign in with a one-time link sent to their e-mail, no password.

This is the first step towards boards that people join with their own account; boards still use their
passwords for now. The whole thing is off unless ACCOUNTS=on, APP_URL is set (the address the links in
the e-mails point to; never taken from the request, or anyone could have a link to their own site mailed
to someone else) and mail can go out (see mailer.py).
"""

import hashlib
import os
import secrets
import time

import psycopg2.errors
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException, Request

import mailer
from auth import _sign, client_ip, failed_logins, issue_user_token, links_per_email, links_per_ip, read_user_token
from schemas import AccountUpdate, CodeVerify, LinkRequest, LinkVerify

router = APIRouter(prefix="/auth", tags=["accounts"])

LINK_MINUTES = 15
# wrong guesses a sign-in code allows before it is spent (a new e-mail brings a new one)
CODE_TRIES = 5
# an account token older than this is swapped for a new one when the app checks in (GET /auth/me), so a
# device in use stays signed in instead of expiring a year after its first sign-in
RENEW_AFTER = 24 * 3600


def accounts_on() -> bool:
    return os.getenv("ACCOUNTS") == "on" and bool(os.getenv("APP_URL")) and mailer.can_send()


def _require_accounts() -> None:
    if not accounts_on():
        raise HTTPException(status_code=404, detail="Accounts are not available on this server")


def _review_code(email: str) -> str | None:
    """The code of App Review's demo account (REVIEW_EMAIL): always REVIEW_CODE, and no e-mail goes out, as
    the reviewers can't read that inbox. None for every other address, or with no valid code set."""
    review = os.getenv("REVIEW_EMAIL", "").strip().lower()
    code = os.getenv("REVIEW_CODE", "").strip()
    return code if review and email == review and len(code) == 6 and code.isdigit() else None


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _code_hash(email: str, code: str) -> str:
    """Keyed with the server's secret: six digits alone would be quick to guess from a stolen hash."""
    return _sign(f"sign-in code:{email}:{code}")


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
    """Mails a sign-in link and a six-digit code: the link for the browser it opens in, the code to type
    wherever the sign-in began (another browser, an app on the home screen). Either one signs in, once.
    The answer is the same whether or not the address has an account."""
    _require_accounts()
    ip = client_ip(request)
    if links_per_ip.blocked(ip) or links_per_email.blocked(body.email):
        raise HTTPException(status_code=429, detail="Too many sign-in links; try again in a while")
    links_per_ip.record(ip)
    links_per_email.record(body.email)

    token = secrets.token_urlsafe(32)
    review = _review_code(body.email)
    code = review or f"{secrets.randbelow(10**6):06d}"
    # links are worthless a few minutes after they are made: keep the table small
    request.app.state.db.execute("DELETE FROM login_links WHERE expires_at < NOW() - INTERVAL '1 day'")
    request.app.state.db.execute(
        """
        INSERT INTO login_links (token_hash, code_hash, email, expires_at)
        VALUES (%s, %s, %s, NOW() + %s * INTERVAL '1 minute')
        """,
        (_hash(token), _code_hash(body.email, code), body.email, LINK_MINUTES),
    )
    link = f"{os.environ['APP_URL'].rstrip('/')}/#/signin?token={token}"
    if review is None:
        tasks.add_task(mailer.send_login_link, body.email, link, body.lang, LINK_MINUTES, code)
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


@router.post("/email/code")
def verify_code(body: CodeVerify, request: Request):
    """Trades the code from a sign-in e-mail for an account token, like its link. A wrong code counts
    against every code the address has open; after CODE_TRIES they are spent."""
    _require_accounts()
    key = f"code:{client_ip(request)}"
    if failed_logins.blocked(key):
        raise HTTPException(status_code=429, detail="Too many wrong codes; try again in a few minutes")
    db = request.app.state.db
    link = db.write_one(
        """
        UPDATE login_links SET used_at = NOW()
        WHERE email = %s AND code_hash = %s AND used_at IS NULL AND expires_at > NOW() AND attempts < %s
        RETURNING email
        """,
        (body.email, _code_hash(body.email, body.code), CODE_TRIES),
    )
    if link is None:
        db.execute(
            """
            UPDATE login_links SET attempts = attempts + 1
            WHERE email = %s AND used_at IS NULL AND expires_at > NOW()
            """,
            (body.email,),
        )
        failed_logins.record(key)
        raise HTTPException(status_code=400, detail="That code is wrong, used or expired")
    user = db.write_one(
        """
        INSERT INTO users (email, last_login_at) VALUES (%s, NOW())
        ON CONFLICT (email) DO UPDATE SET last_login_at = NOW()
        RETURNING *
        """,
        (link["email"],),
    )
    return {"token": issue_user_token(user["id"], user["session_version"]), "user": _public(user)}


@router.get("/me")
def me(request: Request, authorization: str | None = Header(default=None)):
    """The account; with a fresh token in `renewed` when the one sent is more than a day old."""
    user = current_user(request, authorization)
    out = _public(user)
    if read_user_token(authorization[7:])["iat"] + RENEW_AFTER < time.time():
        out["renewed"] = issue_user_token(user["id"], user["session_version"])
    return out


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
