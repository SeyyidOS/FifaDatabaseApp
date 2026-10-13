#!/usr/bin/env python3
"""Match stats read from photos of the game's summary screen ("Özet"), on this server.

Claude Code reads the photos (with the server owner's subscription, no API key) and this script does
the rest:

  deploy/match-stats.py pending [--days N]   photos of matches without stats from the last N days
                                             (default 14), one JSON line each, with a JPEG copy to read
  deploy/match-stats.py submit FILE.json     save the stats read from one photo

FILE.json: {"board": "main", "matchId": 128, "photoId": 1, "A": {...}, "B": {...}}. The keys of A and
B are those of SideStats in backend/schemas.py. A and B are the app's sides (clubA/teamA and
clubB/teamB in the pending line), which need not be the game's left (home) and right sides: match
them by club and score.

Only stdlib; it reads the database through the fifa_db container and saves through the public API
with the server admin key from secrets.env.
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


def pending(days: int) -> None:
    rows = subprocess.run(
        ["docker", "exec", "fifa_db", "psql", "-U", "fifa", "-d", "fifa_db", "-At", "-c", PENDING % days],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.split("\n")
    items = [json.loads(r) for r in rows if r.strip()]
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
    subprocess.run([*docker, *volumes, "fifa-api:local", "-c", convert, *[i["file"] for i in items]], check=True)
    for i in items:
        i["image"] = str(OUT / f"{i.pop('file')}.jpg")
        print(json.dumps(i, ensure_ascii=False))


def admin_key() -> str:
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
    request = urllib.request.Request(
        f"https://{domain()}/api/boards/{data['board']}/matches/{data['matchId']}/stats",
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
    p = sub.add_parser("pending", help="photos of matches without stats")
    p.add_argument("--days", type=int, default=14)
    s = sub.add_parser("submit", help="save the stats read from a photo")
    s.add_argument("file")
    args = parser.parse_args()
    if args.command == "pending":
        pending(args.days)
    else:
        submit(args.file)


if __name__ == "__main__":
    main()
