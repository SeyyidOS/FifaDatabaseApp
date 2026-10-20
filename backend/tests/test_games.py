"""A game's cards and faces: only for devices signed in to a board."""

import json
from pathlib import Path

GAMES = Path(__file__).resolve().parent.parent / "games"


def a_face() -> int:
    return int(next((GAMES / "fc27" / "faces").glob("*.webp")).stem)


def test_cards_and_faces_need_a_board(board):
    assert board.api.get(board.url("/games/fc27/cards")).status_code == 401
    assert board.api.get(board.url(f"/games/fc27/faces/{a_face()}")).status_code == 401

    cards = board.api.get(board.url("/games/fc27/cards"), headers=board.member)
    assert cards.status_code == 200
    assert cards.headers["cache-control"].startswith("private")
    assert cards.json()["game"] == "FC27" and len(cards.json()["clubs"]) > 0

    face = board.api.get(board.url(f"/games/fc27/faces/{a_face()}"), headers=board.member)
    assert face.status_code == 200 and face.headers["content-type"] == "image/webp"
    assert face.content[:4] == b"RIFF"


def test_unknown_games_and_faces(board):
    assert board.api.get(board.url("/games/fc99/cards"), headers=board.member).status_code == 404
    assert board.api.get(board.url("/games/FC27/cards"), headers=board.member).status_code == 404
    assert board.api.get(board.url("/games/fc27/faces/1"), headers=board.member).status_code == 404
    assert board.api.get(board.url("/games/fc27/faces/abc"), headers=board.member).status_code == 422


def test_every_card_with_a_face_has_its_file():
    data = json.loads((GAMES / "fc27" / "cards.json").read_text())
    faces = {int(p.stem) for p in (GAMES / "fc27" / "faces").glob("*.webp")}
    ids = {card["id"] for club in data["clubs"] for card in club["cards"]}
    assert faces <= ids  # no stray faces
    assert len(faces) > 0.9 * len(ids)
