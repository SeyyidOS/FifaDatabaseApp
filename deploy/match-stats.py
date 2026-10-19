#!/usr/bin/env python3
"""Match stats read from photos of the game's summary screen ("Özet"), on this server.

Claude Code reads the photos (with the server owner's subscription, no API key) and this script does
the rest:

  deploy/match-stats.py pending [--days N] [--new]
                                             photos of matches without stats from the last N days
                                             (default 14), one JSON line each, with a JPEG copy to read;
                                             --new leaves out the ones a read has already tried
  deploy/match-stats.py count [--days N] [--new] [--ids]
                                             how many there are, or their photo ids (the database only)
  deploy/match-stats.py tried ID...          note photos a read has tried (saved or skipped)
  deploy/match-stats.py submit FILE.json     save the stats read from one photo

deploy/match-stats-watch.sh runs a read soon after photos come in (root's crontab).

FILE.json: {"board": "main", "matchId": 128, "photoId": 1, "A": {...}, "B": {...}}. The keys of A and
B are those of SideStats in backend/schemas.py. A and B are the app's sides (clubA/teamA and
clubB/teamB in the pending line), which need not be the game's left (home) and right sides: match
them by club and score.

Only stdlib; it reads the database through the fifa_db container and saves through the public API
with the server admin key from secrets.env. FIFA_DB_CONTAINER, FIFA_API_IMAGE, FIFA_API_URL and
FIFA_ADMIN_KEY point it at a scratch copy instead, for trying it out.
"""

import argparse
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

BASE = Path(os.getenv("FIFA_BASE", "/root/programs/fifa-app"))
HERE = Path(__file__).resolve().parent
OUT = Path(os.getenv("STATS_OCR_DIR", "/tmp/fifa-match-stats"))
DB_CONTAINER = os.getenv("FIFA_DB_CONTAINER", "fifa_db")
API_IMAGE = os.getenv("FIFA_API_IMAGE", "fifa-api:local")
# photos a read has tried, saved or skipped (one id a line), so an unreadable one isn't tried again and again
TRIED = Path(os.getenv("STATS_OCR_TRIED", str(BASE / "stats-ocr-tried")))

PENDING = """
SELECT json_build_object(
    'board', b.slug, 'matchId', m.id, 'photoId', ph.id,
    'time', to_char(m.time AT TIME ZONE 'UTC' AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD HH24:MI'),
    'clubA', m.club_a, 'clubB', m.club_b, 'scoreA', m.score_a, 'scoreB', m.score_b,
    'teamA', ARRAY(SELECT p.name FROM match_players mp JOIN players p ON p.id = mp.player_id
                   WHERE mp.match_id = m.id AND mp.side = 'A' ORDER BY mp.slot),
    'teamB', ARRAY(SELECT p.name FROM match_players mp JOIN players p ON p.id = mp.player_id
                   WHERE mp.match_id = m.id AND mp.side = 'B' ORDER BY mp.slot),
    'file', ph.file)
FROM match_photos ph
JOIN matches m ON m.id = ph.match_id
JOIN boards b ON b.id = m.board_id
WHERE NOT EXISTS (SELECT 1 FROM match_stats s WHERE s.match_id = m.id)
  AND m.time > NOW() AT TIME ZONE 'UTC' - make_interval(days => %d)
ORDER BY m.time, ph.id
"""


def tried() -> set[int]:
    return {int(line) for line in TRIED.read_text().split()} if TRIED.exists() else set()


def waiting(days: int, new: bool) -> list[dict]:
    rows = subprocess.run(
        ["docker", "exec", DB_CONTAINER, "psql", "-U", "fifa", "-d", "fifa_db", "-At", "-c", PENDING % days],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.split("\n")
    items = [json.loads(r) for r in rows if r.strip()]
    if new:
        seen = tried()
        items = [i for i in items if i["photoId"] not in seen]
    return items


def mark_tried(ids: list[int]) -> None:
    with TRIED.open("a") as f:
        f.writelines(f"{i}\n" for i in sorted(set(ids) - tried()))


def pending(days: int, new: bool) -> None:
    items = waiting(days, new)
    if not items:
        return
    # JPEG copies (the stored photos are WebP), made with the API image's Pillow
    OUT.mkdir(mode=0o700, exist_ok=True)
    convert = (
        "import sys\nfrom PIL import Image\n"
        "for f in sys.argv[1:]:\n    Image.open(f'/in/{f}.webp').save(f'/out/{f}.jpg', quality=92)\n"
    )
    docker = ["docker", "run", "--rm", "--network", "none", "--user", "0", "--entrypoint", "python"]
    volumes = ["-v", f"{BASE / 'photos'}:/in:ro", "-v", f"{OUT}:/out"]
    subprocess.run([*docker, *volumes, API_IMAGE, "-c", convert, *[i["file"] for i in items]], check=True)
    for i in items:
        i["image"] = str(OUT / f"{i.pop('file')}.jpg")
        print(json.dumps(i, ensure_ascii=False))


def admin_key() -> str:
    if os.getenv("FIFA_ADMIN_KEY"):
        return os.environ["FIFA_ADMIN_KEY"]
    for line in (BASE / "secrets.env").read_text().splitlines():
        if line.startswith("ADMIN_KEY="):
            return line.split("=", 1)[1].strip()
    sys.exit("ADMIN_KEY is not in secrets.env")


def domain() -> str:
    for line in (HERE / "Caddyfile.fifa").read_text().splitlines():
        if line and not line[0].isspace() and line.rstrip().endswith("{"):
            return line.split()[0]
    sys.exit("no site address in Caddyfile.fifa")


def submit(path: str) -> None:
    data = json.loads(Path(path).read_text())
    body = {"A": data["A"], "B": data["B"], "photoId": data.get("photoId"), "source": "ocr"}
    api = os.getenv("FIFA_API_URL") or f"https://{domain()}/api"
    request = urllib.request.Request(
        f"{api}/boards/{data['board']}/matches/{data['matchId']}/stats",
        data=json.dumps(body).encode(),
        method="PUT",
        headers={"Content-Type": "application/json", "X-Admin-Key": admin_key()},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            print(f"match {data['matchId']}: saved ({response.status})")
    except urllib.error.HTTPError as e:
        sys.exit(f"match {data['matchId']}: {e.code} {e.read().decode(errors='replace')}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    for name, about in (("pending", "photos of matches without stats"), ("count", "how many photos wait")):
        p = sub.add_parser(name, help=about)
        p.add_argument("--days", type=int, default=14)
        p.add_argument("--new", action="store_true", help="leave out photos a read has already tried")
        if name == "count":
            p.add_argument("--ids", action="store_true", help="their photo ids instead of how many")
    t = sub.add_parser("tried", help="note photos a read has tried")
    t.add_argument("ids", type=int, nargs="+")
    s = sub.add_parser("submit", help="save the stats read from a photo")
    s.add_argument("file")
    args = parser.parse_args()
    if args.command == "pending":
        pending(args.days, args.new)
    elif args.command == "count":
        items = waiting(args.days, args.new)
        print(" ".join(str(i["photoId"]) for i in items) if args.ids else len(items))
    elif args.command == "tried":
        mark_tried(args.ids)
    else:
        submit(args.file)


if __name__ == "__main__":
    main()
