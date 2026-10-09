"""Turn a card export (fc27-elo's data/players.json + data/img/players) into public/games/<game>/.

Usage: python3 -I scripts/import-fc-cards.py <fc27-elo folder> [--game fc27]   (needs Pillow)

Writes cards.json (every club's normal cards, trimmed to what the club model and squad views use)
and faces/<card id>.webp. Club names follow ours (backend/data/seasons/*.csv) so crests and match
history line up; the in-game name is kept as gameName. The export is treated as untrusted data:
fields are validated and every image is decoded and re-encoded.
"""

import argparse
import csv
import io
import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SEASONS = ROOT.parent / "backend" / "data" / "seasons"

STATS = ["PAC", "SHO", "PAS", "DRI", "DEF", "PHY"]
POSITIONS = {"GK", "CB", "LB", "RB", "LWB", "RWB", "CDM", "CM", "CAM", "ST", "CF", "LW", "RW", "LM", "RM"}
QUALITIES = {"gold", "silver", "bronze"}
# export name (teams.txt) -> our club name, where they differ
RENAMES = {"Paris Saint-Germain (PSG)": "Paris Saint-Germain", "PSV Eindhoven": "PSV", "Monaco": "AS Monaco"}


def text(value, limit: int) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"expected text, got {value!r}")
    return " ".join(value.split())[:limit]


def integer(value, low: int, high: int) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or not low <= value <= high:
        raise ValueError(f"expected an integer in [{low}, {high}], got {value!r}")
    return value


def card(raw: dict) -> dict:
    pos = text(raw["pos"], 4)
    if pos not in POSITIONS:
        raise ValueError(f"unknown position {pos!r}")
    stats = raw.get("stats") or {}
    out = {
        "id": integer(raw["id"], 1, 10**9),
        "name": text(raw.get("card") or raw["name"], 40),
        "fullName": text(raw["name"], 60),
        "ovr": integer(raw["ovr"], 1, 99),
        "pos": pos,
        "alt": [a for a in raw.get("alt") or [] if a in POSITIONS and a != pos],
        # goalkeepers keep no outfield stats: the model only uses their overall
        "stats": None if pos == "GK" else [integer(stats.get(k), 1, 99) if stats.get(k) is not None else None for k in STATS],
    }
    if isinstance(raw.get("age"), int):
        out["age"] = integer(raw["age"], 14, 50)
    quality = str(raw.get("quality", "")).lower()
    if quality in QUALITIES:
        out["quality"] = quality
    if raw.get("rarity") == "Rare":
        out["rare"] = True
    return out


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--game", default="fc27")
    args = parser.parse_args()

    export = json.loads((args.source / "data" / "players.json").read_text(encoding="utf-8"))
    ours = set()
    for path in SEASONS.glob("*.csv"):
        with path.open(encoding="utf-8") as f:
            ours |= {row["name"] for row in csv.DictReader(f)}

    clubs, seen = [], set()
    for team in export["teams"]:
        name = RENAMES.get(team["query"], text(team["query"], 100))
        ea_id = integer(team["id"], 1, 10**9)
        if ea_id in seen:
            raise ValueError(f"club {ea_id} listed twice")
        seen.add(ea_id)
        cards = [card(p) for p in team["players"]]
        clubs.append(
            {
                "eaId": ea_id,
                "name": name,
                "gameName": text(team["name"], 100),
                "league": re.sub(r"\s+McDonald's$|\s+Enilive$|\s+EA SPORTS$", "", text(team["league"], 60)),
                # export order (best first): the squad selection breaks ties by it
                "cards": cards,
            }
        )
        print(f"{'known' if name in ours else 'NEW  '} {name:28} ({team['name']}) {len(cards)} cards")

    out = ROOT / "public" / "games" / args.game
    faces = out / "faces"
    faces.mkdir(parents=True, exist_ok=True)
    data = {
        "game": args.game.upper(),
        "source": "fut.gg",
        "fetchedAt": text(export.get("fetchedAt", ""), 40),
        "clubs": clubs,
    }
    (out / "cards.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    copied = missing = 0
    for club in clubs:
        for c in club["cards"]:
            src = args.source / "data" / "img" / "players" / f"{c['id']}.webp"
            dest = faces / f"{c['id']}.webp"
            if dest.exists():
                continue
            if not src.exists():
                missing += 1
                continue
            img = Image.open(io.BytesIO(src.read_bytes()))
            img.load()
            img = img.convert("RGBA")
            img.thumbnail((96, 96), Image.LANCZOS)
            img.save(dest, "WEBP", quality=82, method=6)
            copied += 1
    size = sum(p.stat().st_size for p in faces.glob("*.webp"))
    print(f"{len(clubs)} clubs, {sum(len(c['cards']) for c in clubs)} cards -> {out / 'cards.json'}")
    print(f"{copied} new faces, {size / 1e6:.1f} MB in all, {missing} cards without a face")


if __name__ == "__main__":
    main()
