"""Board access: password hashing, signed device tokens, rate limits and the FastAPI dependencies.

A board has two passwords. The board password (shared with the group) gives the "member" role: see
everything, add players, log matches. The admin password gives the "admin" role: archive and delete,
change settings and passwords. Logging in returns a signed token that the browser keeps, so a device
stays signed in; changing a password bumps that role's version, which invalidates its old tokens.
"""

import base64
import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import threading
import time
import unicodedata
from collections import deque
from dataclasses import dataclass
from typing import Literal

from fastapi import Depends, Header, HTTPException, Request

Role = Literal["member", "admin"]
TOKEN_TTL = 365 * 24 * 3600
SCRYPT = {"n": 2**14, "r": 8, "p": 1}

log = logging.getLogger("fifa.auth")
_fallback_secret = secrets.token_bytes(32)


# ----------- Passwords -----------
def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, dklen=32, **SCRYPT)
    return f"scrypt${SCRYPT['n']}${SCRYPT['r']}${SCRYPT['p']}${_b64(salt)}${_b64(digest)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = _unb64(digest)
        actual = hashlib.scrypt(password.encode(), salt=_unb64(salt), n=int(n), r=int(r), p=int(p), dklen=len(expected))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(actual, expected)


# ----------- Tokens -----------
def _secret() -> bytes:
    key = os.getenv("SECRET_KEY")
    if key:
        return key.encode()
    # without SECRET_KEY, devices are signed out whenever the API restarts
    return _fallback_secret


def _sign(body: str) -> str:
    return _b64(hmac.new(_secret(), body.encode(), hashlib.sha256).digest())


def issue_token(board_id: int, role: Role, version: int) -> str:
    payload = {"b": board_id, "r": role, "v": version, "iat": int(time.time())}
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    return f"{body}.{_sign(body)}"


def read_token(token: str) -> dict | None:
    try:
        body, signature = token.split(".")
        if not hmac.compare_digest(signature, _sign(body)):
            return None
        payload = json.loads(_unb64(body))
    except (ValueError, TypeError):
        return None
    if payload.get("r") not in ("member", "admin") or payload.get("iat", 0) + TOKEN_TTL < time.time():
        return None
    return payload


def server_admin_key_matches(candidate: str | None) -> bool:
    """ADMIN_KEY (set by the operator) works as an admin login for every board."""
    key = os.getenv("ADMIN_KEY", "")
    return bool(key and candidate) and hmac.compare_digest(candidate.encode(), key.encode())


# ----------- Rate limiting -----------
class RateLimiter:
    """At most `limit` events per `window` seconds per key (in memory, per API process)."""

    def __init__(self, limit: int, window: float):
        self.limit, self.window = limit, window
        self._events: dict[str, deque[float]] = {}
        self._lock = threading.Lock()

    def _recent(self, key: str, now: float) -> deque[float]:
        events = self._events.setdefault(key, deque())
        while events and events[0] <= now - self.window:
            events.popleft()
        return events

    def blocked(self, key: str) -> bool:
        with self._lock:
            return len(self._recent(key, time.monotonic())) >= self.limit

    def record(self, key: str) -> None:
        with self._lock:
            now = time.monotonic()
            self._recent(key, now).append(now)
            if len(self._events) > 10_000:  # forget idle keys
                self._events = {k: v for k, v in self._events.items() if v}


failed_logins = RateLimiter(limit=10, window=15 * 60)
board_creations = RateLimiter(limit=5, window=60 * 60)


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


# ----------- Slugs -----------
_TURKISH = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")


def slugify(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name.translate(_TURKISH)).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_name.lower()).strip("-")[:40].strip("-")
    return slug or "board"


# ----------- Dependencies -----------
@dataclass
class BoardAccess:
    id: int
    slug: str
    name: str
    k_factor: int
    club_weight: float
    role: Role


BOARD_COLUMNS = "id, slug, name, k_factor, club_weight, member_version, admin_version"


def board_access(
    slug: str,
    request: Request,
    authorization: str | None = Header(default=None),
    x_admin_key: str | None = Header(default=None),
) -> BoardAccess:
    board = request.app.state.db.fetch_one(f"SELECT {BOARD_COLUMNS} FROM boards WHERE slug = %s", (slug,))
    if board is None:
        raise HTTPException(status_code=404, detail="Board not found")

    def access(role: Role) -> BoardAccess:
        return BoardAccess(board["id"], board["slug"], board["name"], board["k_factor"], board["club_weight"], role)

    if server_admin_key_matches(x_admin_key):
        return access("admin")
    token = authorization[7:] if authorization and authorization.lower().startswith("bearer ") else None
    payload = read_token(token) if token else None
    if payload is None or payload["b"] != board["id"]:
        raise HTTPException(status_code=401, detail="Sign in to this board")
    current = board["admin_version"] if payload["r"] == "admin" else board["member_version"]
    if payload["v"] != current:
        raise HTTPException(status_code=401, detail="The board password changed; sign in again")
    return access(payload["r"])


def board_admin(access: BoardAccess = Depends(board_access)) -> BoardAccess:
    if access.role != "admin":
        raise HTTPException(status_code=403, detail="Only board admins can do this")
    return access
