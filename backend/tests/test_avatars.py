"""Account photos: uploaded once, shown wherever the account's player appears."""

import io

from conftest import ADMIN_PW, bearer, sign_in
from PIL import Image


def picture(color=(200, 30, 30), size=(800, 600)) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", size, color).save(out, "PNG")
    return out.getvalue()


def test_an_account_photo(api, mail, board):
    board.add_players("kerem", "ozgun")
    board.add_match(["kerem"], ["ozgun"], 2, 1)
    me = sign_in(api, mail)
    assert me["user"]["photo"] is None
    auth = bearer(me["token"])
    api.post(board.url("/claim"), json={"password": ADMIN_PW}, headers=auth)
    ids = {p["name"]: p["id"] for p in api.get(board.url("/players"), headers=board.member).json()}
    api.put(board.url("/membership/player"), json={"playerId": ids["kerem"]}, headers=auth)

    assert api.put("/auth/me/photo", content=picture()).status_code == 401
    assert api.put("/auth/me/photo", content=b"not a picture", headers=auth).status_code == 415
    uploaded = api.put("/auth/me/photo", content=picture(), headers=auth)
    assert uploaded.status_code == 200, uploaded.text
    name = uploaded.json()["photo"]
    got = api.get(f"/avatars/{name}")
    assert got.status_code == 200
    assert got.headers["content-type"] == "image/webp" and "immutable" in got.headers["cache-control"]
    with Image.open(io.BytesIO(got.content)) as image:
        assert image.size == (512, 512)  # the middle square

    # it is kerem's photo in the league, and the account's
    players = api.get(board.url("/players"), headers=board.member).json()
    assert {p["name"]: p["photo"] for p in players} == {"kerem": name, "ozgun": None}
    assert api.get("/auth/me", headers=auth).json()["photo"] == name
    assert api.get(board.url("/members"), headers=auth).json()["members"][0]["photo"] == name

    # a new one replaces it, and the old file is gone
    newer = api.put("/auth/me/photo", content=picture((30, 30, 200)), headers=auth).json()["photo"]
    assert newer != name and api.get(f"/avatars/{name}").status_code == 404
    assert api.delete("/auth/me/photo", headers=auth).json()["photo"] is None
    assert api.get(f"/avatars/{newer}").status_code == 404
    assert api.get("/avatars/..%2F..%2Fetc").status_code == 404
