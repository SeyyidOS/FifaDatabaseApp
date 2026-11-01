#!/usr/bin/env python3
"""Acting on reports (backend/moderation.py): App Store rules ask that what breaks the terms is removed, and the
account behind it put out, within 24 hours of a report. Each report is also mailed to SUPPORT_EMAIL.

  deploy/moderate.py                         open reports, oldest first, with how long each has waited
  deploy/moderate.py all                     every report, newest first
  deploy/moderate.py show ID                 one report, and the commands that act on it
  deploy/moderate.py photo SLUG PHOTO_ID     deletes a match photo
  deploy/moderate.py rename SLUG PLAYER_ID NAME
                                             renames a player whose name breaks the terms
  deploy/moderate.py suspend ACCOUNT_ID      puts an account out: signed out everywhere, can't sign in again
  deploy/moderate.py unsuspend ACCOUNT_ID
  deploy/moderate.py resolve ID WHAT_WAS_DONE
                                             closes a report

It talks to the live API with the server's ADMIN_KEY from secrets.env; FIFA_API_URL and ADMIN_KEY point it
at a scratch copy instead.
"""

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = Path(os.getenv("FIFA_BASE", "/root/programs/fifa-app"))
HERE = Path(__file__).resolve().parent
DEADLINE_HOURS = 24


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


def call(method: str, path: str, body: dict | None = None):
    headers = {"X-Admin-Key": setting("ADMIN_KEY")}
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(f"{api_url()}{path}", data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read() or b"null")
    except urllib.error.HTTPError as exc:
        sys.exit(f"{method} {path}: {exc.code} {exc.read().decode(errors='replace')}")


def waited(created: str) -> str:
    hours = (datetime.now(timezone.utc) - datetime.fromisoformat(created)).total_seconds() / 3600
    late = "  LATE" if hours > DEADLINE_HOURS else ""
    return f"{hours:4.0f}h{late}"


def line(r: dict) -> str:
    state = f"done: {r['resolution']}" if r["resolvedAt"] else waited(r["createdAt"])
    return f"#{r['id']:<4} {state:<10} {r['board']:<22} {r['reason']:<13} {r['subject']}"


def show(r: dict) -> None:
    print(line(r))
    print(f"  reported   {r['createdAt']}")
    print(f"  their note {r['note'] or '-'}")
    if r["accountId"] is not None:
        who = r["accountName"] or "(no name)"
        suspended = ", suspended" if r["suspended"] else ""
        print(f"  account    {r['accountId']}: {who} <{r['accountEmail']}>{suspended}")
    print("\nTo act on it:")
    if r["kind"] == "photo":
        print(f"  deploy/moderate.py photo {r['board']} {r['targetId']}")
    else:
        print(f"  deploy/moderate.py rename {r['board']} {r['targetId']} NEW_NAME")
    if r["accountId"] is not None and not r["suspended"]:
        print(f"  deploy/moderate.py suspend {r['accountId']}")
    print(f'  deploy/moderate.py resolve {r["id"]} "what was done"')


def main(args: list[str]) -> None:
    command = args[0] if args else "list"
    if command in ("list", "all"):
        reports = call("GET", "/admin/reports" + ("?all=true" if command == "all" else ""))
        print("\n".join(line(r) for r in reports) or "No open reports.")
    elif command == "show" and len(args) == 2:
        report = next((r for r in call("GET", "/admin/reports?all=true") if str(r["id"]) == args[1]), None)
        if report is None:
            sys.exit(f"No report #{args[1]}")
        show(report)
    elif command == "photo" and len(args) == 3:
        print(call("DELETE", f"/boards/{args[1]}/photos/{int(args[2])}")["message"])
    elif command == "rename" and len(args) == 4:
        player = call("PATCH", f"/boards/{args[1]}/players/{int(args[2])}", {"name": args[3]})
        print(f"Player {args[2]} is now {player['name']!r}.")
    elif command == "suspend" and len(args) == 2:
        call("PUT", f"/admin/users/{int(args[1])}/suspension")
        print(f"Account {args[1]} is suspended.")
    elif command == "unsuspend" and len(args) == 2:
        call("DELETE", f"/admin/users/{int(args[1])}/suspension")
        print(f"Account {args[1]} can sign in again.")
    elif command == "resolve" and len(args) == 3:
        call("POST", f"/admin/reports/{int(args[1])}/resolve", {"resolution": args[2]})
        print(f"Report #{args[1]} is closed.")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
