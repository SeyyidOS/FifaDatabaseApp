import io

import pytest
from conftest import Board
from PIL import Image

SIDE_A = {"possession": 47, "shots": 8, "xg": 1.87, "passes": 134, "passAccuracy": 84, "yellowCards": 1}
SIDE_B = {"possession": 53, "shots": 6, "xg": 2.42, "passes": 130, "passAccuracy": 85, "saves": 4}


@pytest.fixture
def match_id(board):
    board.add_players("a", "b", "c", "d")
    return board.add_match(["a", "b"], ["c", "d"], 2, 3).json()["id"]


def stats_of(board: Board):
    return board.api.get(board.url("/matches"), headers=board.member).json()[0]["stats"]


def put(board: Board, match_id: int, body: dict, headers=None):
    return board.api.put(board.url(f"/matches/{match_id}/stats"), json=body, headers=headers or board.member)


def test_stats_are_listed_with_their_match(board, match_id):
    assert stats_of(board) is None
    saved = put(board, match_id, {"A": SIDE_A, "B": SIDE_B})
    assert saved.status_code == 200, saved.text
    assert stats_of(board) == {"A": SIDE_A, "B": SIDE_B, "source": "manual", "photoId": None}

    # saving again replaces them, missing numbers included
    assert put(board, match_id, {"A": {"shots": 9}, "B": {}, "source": "ocr"}).status_code == 200
    assert stats_of(board) == {"A": {"shots": 9}, "B": {}, "source": "ocr", "photoId": None}


def test_stats_can_point_at_a_photo_of_the_match(board, match_id):
    image = io.BytesIO()
    Image.new("RGB", (64, 48)).save(image, "JPEG")
    upload = board.api.post(
        board.url(f"/matches/{match_id}/photos"),
        content=image.getvalue(),
        headers={**board.member, "Content-Type": "image/jpeg"},
    )
    photo_id = upload.json()["id"]
    assert put(board, match_id, {"A": SIDE_A, "B": SIDE_B, "photoId": photo_id, "source": "ocr"}).status_code == 200
    assert stats_of(board)["photoId"] == photo_id
    assert put(board, match_id, {"A": SIDE_A, "B": SIDE_B, "photoId": photo_id + 1}).status_code == 422

    # the stats outlive the photo they came from
    assert board.api.delete(board.url(f"/photos/{photo_id}"), headers=board.member).status_code == 200
    assert stats_of(board)["photoId"] is None


@pytest.mark.parametrize(
    "side",
    [{"possession": 101}, {"shots": -1}, {"xg": "a lot"}, {"goals": 3}, {"passAccuracy": 100.5}],
)
def test_invalid_stats_are_rejected(board, match_id, side):
    assert put(board, match_id, {"A": side, "B": {}}).status_code == 422
    assert stats_of(board) is None


def test_stats_stay_inside_their_board(api, board, match_id):
    other = Board(api, "Other Crew")
    assert put(other, match_id, {"A": SIDE_A, "B": SIDE_B}).status_code == 404
    assert api.put(board.url(f"/matches/{match_id}/stats"), json={"A": {}, "B": {}}).status_code == 401
    assert put(board, match_id, {"A": SIDE_A, "B": SIDE_B}).status_code == 200
    assert api.delete(other.url(f"/matches/{match_id}/stats"), headers=other.admin).status_code == 404


def test_deleting_stats_or_their_match(board, match_id):
    assert board.api.delete(board.url(f"/matches/{match_id}/stats"), headers=board.member).status_code == 404
    put(board, match_id, {"A": SIDE_A, "B": SIDE_B})
    assert board.api.delete(board.url(f"/matches/{match_id}/stats"), headers=board.member).status_code == 200
    assert stats_of(board) is None

    put(board, match_id, {"A": SIDE_A, "B": SIDE_B})
    assert board.api.delete(board.url(f"/matches/{match_id}"), headers=board.admin).status_code == 200
    assert board.api.get(board.url("/matches"), headers=board.member).json() == []
