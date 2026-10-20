"""A football game's card data for the clubs pages: cards.json and the players' faces, in games/<game>/
(frontend/scripts/import-fc-cards.py writes them).

They are served to devices signed in to a board, never as public files: the cards and faces aren't ours to
publish, so only the leagues that use them can load them.
"""

import re
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from auth import board_access
from edition import classic_only

GAMES = Path(__file__).resolve().parent / "games"

# signed in, and classic only: the store edition has no cards (edition.py)
router = APIRouter(
    prefix="/boards/{slug}/games", tags=["game data"], dependencies=[Depends(board_access), Depends(classic_only)]
)


def _game(game: str) -> Path:
    folder = GAMES / game
    if not re.fullmatch(r"[a-z0-9]{2,12}", game) or not (folder / "cards.json").is_file():
        raise HTTPException(status_code=404, detail="No cards for that game")
    return folder


@router.get("/{game}/cards")
def cards(game: str):
    # a new import ships with a deploy, so an hour is fresh enough
    return FileResponse(
        _game(game) / "cards.json", media_type="application/json", headers={"Cache-Control": "private, max-age=3600"}
    )


@router.get("/{game}/faces/{card_id}")
def face(game: str, card_id: int):
    path = _game(game) / "faces" / f"{card_id}.webp"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="No face for that card")
    return FileResponse(path, media_type="image/webp", headers={"Cache-Control": "private, max-age=2592000, immutable"})
