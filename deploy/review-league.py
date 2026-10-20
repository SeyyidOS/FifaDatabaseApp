#!/usr/bin/env python3
"""A league for App Review to look at, owned by the demo account (REVIEW_EMAIL and REVIEW_CODE in
secrets.env, which signs in with that code and gets no e-mail).

  deploy/review-league.py        makes it, unless the account is in a league already

Six players with four match nights behind them. It signs in as the demo account through the public API,
as the app does, and moves the matches back to past Fridays through the fifa_db container (the API dates a
match when it is logged). FIFA_API_URL, FIFA_DB_CONTAINER and the REVIEW_* variables point it at a scratch
copy instead.
"""

import json
import os
import random
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE = Path(os.getenv("FIFA_BASE", "/root/programs/fifa-app"))
HERE = Path(__file__).resolve().parent
DB_CONTAINER = os.getenv("FIFA_DB_CONTAINER", "fifa_db")

LEAGUE = "Friday Night League"
PLAYERS = ["Alex", "Sam", "Jordan", "Taylor", "Morgan", "Casey"]
CLUBS = [
    "Real Madrid",
    "Barcelona",
    "Paris Saint-Germain",
    "Bayern Munich",
    "Manchester City",
    "Liverpool",
    "Arsenal",
    "Inter Milan",
    "Juventus FC",
    "AC Milan",
    "Borussia Dortmund",
    "Atletico Madrid",
]
NIGHTS, PER_NIGHT = 4, 8

# the nights' matches, oldest first: the last few Fridays, from 21:00 Istanbul (18:00 UTC), one every 14 minutes
BACKDATE = f"""
WITH n AS (
    SELECT id, row_number() OVER (ORDER BY id) - 1 AS i FROM matches
    WHERE board_id = (SELECT id FROM boards WHERE slug = :'slug')
), friday AS (
    -- days back to the last Friday before today
    SELECT COALESCE(NULLIF((EXTRACT(ISODOW FROM NOW() AT TIME ZONE 'UTC')::int + 2) % 7, 0), 7) AS back
)
UPDATE matches m
SET time = date_trunc('day', NOW() AT TIME ZONE 'UTC')
    - (friday.back + ({NIGHTS - 1} - n.i / {PER_NIGHT}) * 7) * INTERVAL '1 day'
    + INTERVAL '18 hours' + (n.i % {PER_NIGHT}) * INTERVAL '14 minutes'
FROM n, friday WHERE m.id = n.id;
"""


def setting(name: str) -> str:
    if os.getenv(name):
        return os.environ[name]
    for line in (BASE / "secrets.env").read_text().splitlines():
        if line.startswith(f"{name}="):
            return line.split("=", 1)[1].strip().strip('"')
    sys.exit(f"{name} is not in secrets.env")


def api_url() -> str:
    if os.getenv("FIFA_API_URL"):
        return os.environ["FIFA_API_URL"].rstrip("/")
    for line in (HERE / "Caddyfile.fifa").read_text().splitlines():
        if line and not line[0].isspace() and line.rstrip().endswith("{"):
            return f"https://{line.split()[0]}/api"
    sys.exit("no site address in Caddyfile.fifa")


def call(method: str, path: str, body: dict | None = None, token: str | None = None):
    headers = {"Content-Type": "application/json"} | ({"Authorization": f"Bearer {token}"} if token else {})
    data = None if body is None else json.dumps(body).encode()
    request = urllib.request.Request(api_url() + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path}: {e.code} {e.read().decode(errors='replace')}")


def main() -> None:
    email, code = setting("REVIEW_EMAIL").lower(), setting("REVIEW_CODE")
    call("POST", "/auth/email", {"email": email, "lang": "en"})
    account = call("POST", "/auth/email/code", {"email": email, "code": code})["token"]
    if call("GET", "/auth/boards", token=account):
        sys.exit(f"{email} is in a league already; nothing to do")
    call("PATCH", "/auth/me", {"name": PLAYERS[0]}, account)

    league = call("POST", "/boards", {"name": LEAGUE}, account)
    slug, board = league["slug"], league["token"]
    for name in PLAYERS:
        call("POST", f"/boards/{slug}/players", {"name": name}, board)
    # the API keeps names in lower case, the app capitalises them
    ids = {p["name"]: p["id"] for p in call("GET", f"/boards/{slug}/players", token=board)}
    call("PUT", f"/boards/{slug}/membership/player", {"playerId": ids[PLAYERS[0].lower()]}, account)

    rng = random.Random(2026)
    for _ in range(NIGHTS * PER_NIGHT):
        four = rng.sample(PLAYERS, 4)
        club_a, club_b = rng.sample(CLUBS, 2)
        score = rng.choices(range(6), weights=[14, 26, 26, 18, 10, 6], k=2)
        match = {"clubA": club_a, "clubB": club_b, "teamA": four[:2], "teamB": four[2:]}
        call("POST", f"/boards/{slug}/matches", match | {"scoreA": score[0], "scoreB": score[1]}, board)

    psql = ["docker", "exec", "-i", DB_CONTAINER, "psql", "-q", "-U", "fifa", "-d", "fifa_db", "-v", f"slug={slug}"]
    subprocess.run([*psql, "-v", "ON_ERROR_STOP=1"], input=BACKDATE, text=True, check=True)
    print(f"{LEAGUE} ({slug}): {len(PLAYERS)} players, {NIGHTS * PER_NIGHT} matches over {NIGHTS} nights")


if __name__ == "__main__":
    main()
