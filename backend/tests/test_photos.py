import io

import pytest
from conftest import Board
from PIL import Image

import photos


def jpeg(width=3000, height=2000, orientation=None) -> bytes:
    image = Image.new("RGB", (width, height), (200, 30, 30))
    exif = Image.Exif()
    exif[0x0110] = "Test Phone"  # camera model
    if orientation:
        exif[0x0112] = orientation
    out = io.BytesIO()
    image.save(out, "JPEG", exif=exif)
    return out.getvalue()


def upload(board: Board, match_id: int, body: bytes, content_type="image/jpeg", headers=None):
    headers = {**(headers or board.member), "Content-Type": content_type}
    return board.api.post(board.url(f"/matches/{match_id}/photos"), content=body, headers=headers)


@pytest.fixture
def match_id(board):
    board.add_players("a", "b", "c", "d")
    return board.add_match(["a", "b"], ["c", "d"], 2, 1).json()["id"]


def test_a_photo_is_shrunk_turned_upright_and_stripped(board, match_id):
    # orientation 6: the camera was turned, so the stored pixels are on their side
    created = upload(board, match_id, jpeg(3000, 2000, orientation=6))
    assert created.status_code == 201, created.text
    photo = created.json()
    assert (photo["matchId"], photo["width"], photo["height"]) == (match_id, 1707, 2560)

    full = board.api.get(board.url(f"/photos/{photo['id']}"), headers=board.member)
    assert full.status_code == 200
    assert full.headers["content-type"] == "image/webp"
    assert "private" in full.headers["cache-control"]
    image = Image.open(io.BytesIO(full.content))
    assert (image.format, image.size) == ("WEBP", (1707, 2560))
    assert not image.getexif()

    thumb = board.api.get(board.url(f"/photos/{photo['id']}?size=thumb"), headers=board.member)
    assert Image.open(io.BytesIO(thumb.content)).size == (320, 480)

    match = board.api.get(board.url("/matches"), headers=board.member).json()[0]
    assert match["photos"] == [photo["id"]]
    listed = board.api.get(board.url(f"/matches/{match_id}/photos"), headers=board.member).json()
    assert [p["id"] for p in listed] == [photo["id"]]


def test_small_photos_keep_their_size(board, match_id):
    photo = upload(board, match_id, jpeg(800, 600)).json()
    assert (photo["width"], photo["height"]) == (800, 600)


def test_only_images_are_taken(board, match_id):
    assert upload(board, match_id, b"").status_code == 422
    assert upload(board, match_id, b"not an image at all", "application/octet-stream").status_code == 415
    gif = io.BytesIO()
    Image.new("RGB", (10, 10)).save(gif, "GIF")
    assert upload(board, match_id, gif.getvalue(), "image/gif").status_code == 415
    huge = io.BytesIO()
    Image.new("L", (5000, 4000)).save(huge, "PNG")
    assert upload(board, match_id, huge.getvalue(), "image/png").status_code == 413
    assert upload(board, match_id + 1, jpeg(100, 100)).status_code == 404
    assert board.api.get(board.url("/matches"), headers=board.member).json()[0]["photos"] == []


def test_a_match_holds_a_limited_number_of_photos(board, match_id):
    small = jpeg(100, 100)
    for _ in range(photos.MAX_PHOTOS):
        assert upload(board, match_id, small).status_code == 201
    assert upload(board, match_id, small).status_code == 409


def test_photos_stay_inside_their_board(api, board, match_id):
    photo_id = upload(board, match_id, jpeg(100, 100)).json()["id"]
    other = Board(api, "Other Crew")
    assert upload(other, match_id, jpeg(100, 100)).status_code == 404
    assert api.get(other.url(f"/photos/{photo_id}"), headers=other.member).status_code == 404
    assert api.get(other.url(f"/matches/{match_id}/photos"), headers=other.member).status_code == 404
    assert api.delete(other.url(f"/photos/{photo_id}"), headers=other.admin).status_code == 404
    assert api.get(board.url(f"/photos/{photo_id}")).status_code == 401
    assert api.post(board.url(f"/matches/{match_id}/photos"), content=jpeg(100, 100)).status_code == 401


def test_deleting_a_photo_or_its_match_removes_the_files(board, match_id):
    def files():
        return sorted(p.name for p in photos.photo_dir().glob("*.webp"))

    before = files()
    first = upload(board, match_id, jpeg(100, 100)).json()["id"]
    second = upload(board, match_id, jpeg(100, 100)).json()["id"]
    assert len(files()) == len(before) + 4

    assert board.api.delete(board.url(f"/photos/{first}"), headers=board.member).status_code == 200
    assert board.api.get(board.url(f"/photos/{first}"), headers=board.member).status_code == 404
    assert len(files()) == len(before) + 2

    assert board.api.delete(board.url(f"/matches/{match_id}"), headers=board.admin).status_code == 200
    assert board.api.get(board.url(f"/photos/{second}"), headers=board.member).status_code == 404
    assert files() == before
