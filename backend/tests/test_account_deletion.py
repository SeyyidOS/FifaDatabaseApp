"""Deleting an account from the app: what happens to its boards, and that nothing of it is left behind."""

import io

from conftest import Board, bearer, sign_in
from PIL import Image

import photos


def png() -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (64, 64), (10, 120, 200)).save(out, "PNG")
    return out.getvalue()


def join(api, mail, owner, slug, player_id, email):
    """`email` joins the board as that player, with a personal link from the owner."""
    code = api.post(f"/boards/{slug}/invites", json={"playerId": player_id}, headers=bearer(owner["token"]))
    person = sign_in(api, mail, email)
    accepted = api.post(f"/invites/{code.json()['code']}/accept", json={}, headers=bearer(person["token"]))
    assert accepted.status_code == 200, accepted.text
    return person


def league(api, owner, name):
    """A league the account starts, with no passwords; returns its slug and a board token."""
    created = api.post("/boards", json={"name": name}, headers=bearer(owner["token"]))
    assert created.status_code == 201, created.text
    return created.json()["slug"], bearer(created.json()["token"])


def player_ids(api, slug, headers):
    return {p["name"]: p["id"] for p in api.get(f"/boards/{slug}/players", headers=headers).json()}


def test_deleting_an_account(api, mail, board):
    kerem = sign_in(api, mail, "kerem@example.com")
    me = bearer(kerem["token"])
    assert api.put("/auth/me/photo", content=png(), headers=me).status_code == 200
    avatar = photos.photo_dir() / "avatars" / f"{api.get('/auth/me', headers=me).json()['photo']}.webp"
    assert avatar.is_file()

    # 1. a league kerem owns with an admin and a player in it: it passes to the admin
    crew, crew_admin = league(api, kerem, "Office League")
    for name in ("kerem", "ozgun", "seyyid"):
        api.post(f"/boards/{crew}/players", json={"name": name}, headers=crew_admin)
    ids = player_ids(api, crew, crew_admin)
    api.put(f"/boards/{crew}/membership/player", json={"playerId": ids["kerem"]}, headers=me)
    seyyid = join(api, mail, kerem, crew, ids["seyyid"], "seyyid@example.com")
    ozgun = join(api, mail, kerem, crew, ids["ozgun"], "ozgun@example.com")
    ozgun_id = api.get("/auth/me", headers=bearer(ozgun["token"])).json()["id"]
    api.patch(f"/boards/{crew}/members/{ozgun_id}", json={"role": "admin"}, headers=me)
    session = api.post(f"/boards/{crew}/session", headers=me).json()
    sides = {"clubA": "Arsenal", "clubB": "Chelsea", "teamA": ["kerem"], "teamB": ["seyyid"], "scoreA": 2, "scoreB": 1}
    logged = api.post(f"/boards/{crew}/matches", json=sides, headers=bearer(session["token"]))
    assert logged.status_code == 201, logged.text

    # 2. a league only kerem is in: it goes with the account, photos and all
    alone, alone_admin = league(api, kerem, "Solo Nights")
    api.post(f"/boards/{alone}/players", json={"name": "a"}, headers=alone_admin)
    api.post(f"/boards/{alone}/players", json={"name": "b"}, headers=alone_admin)
    match = api.post(
        f"/boards/{alone}/matches",
        json={"clubA": "Arsenal", "clubB": "Chelsea", "teamA": ["a"], "teamB": ["b"], "scoreA": 1, "scoreB": 0},
        headers=alone_admin,
    ).json()
    photo = api.post(
        f"/boards/{alone}/matches/{match['id']}/photos",
        content=png(),
        headers={**alone_admin, "Content-Type": "image/png"},
    ).json()
    files = list(photos.photo_dir().glob("*.webp"))
    assert files

    # 3. a board with passwords that kerem claimed, nobody else on an account: it stays, ownerless
    api.post(board.url("/claim"), json={"password": "admin-pass"}, headers=me)

    # 4. a league where kerem is just a player
    other = Board(api, "Ozgun's Crew")
    other.add_players("kerem2")
    api.post(other.url("/claim"), json={"password": "admin-pass"}, headers=bearer(ozgun["token"]))
    join(api, mail, ozgun, other.slug, player_ids(api, other.slug, other.admin)["kerem2"], "kerem@example.com")

    preview = api.get("/auth/me/deletion", headers=me).json()
    assert preview == [
        {"slug": crew, "name": "Office League", "fate": "handover", "heir": "ozgun"},
        {"slug": alone, "name": "Solo Nights", "fate": "delete", "heir": None},
        {"slug": board.slug, "name": "Kerem's Crew", "fate": "keep", "heir": None},
        {"slug": other.slug, "name": "Ozgun's Crew", "fate": "leave", "heir": None},
    ]

    assert api.delete("/auth/me", headers=me).status_code == 204

    # signed out everywhere: the account and the board tokens it was given
    assert api.get("/auth/me", headers=me).status_code == 401
    assert api.get(f"/boards/{crew}/me", headers=bearer(session["token"])).status_code == 401
    db = api.app.state.db
    assert db.fetch_one("SELECT 1 FROM users WHERE email = 'kerem@example.com'") is None
    assert db.fetch_one("SELECT 1 FROM login_links WHERE email = 'kerem@example.com'") is None
    assert not avatar.exists()

    # the office league is ozgun's now; kerem's player and the match stay, without saying who logged it
    roles = {r["slug"]: r["role"] for r in api.get("/auth/boards", headers=bearer(ozgun["token"])).json()}
    assert roles == {crew: "owner", other.slug: "owner"}
    assert api.get("/auth/boards", headers=bearer(seyyid["token"])).json()[0]["role"] == "player"
    ozgun_session = api.post(f"/boards/{crew}/session", headers=bearer(ozgun["token"])).json()
    assert "kerem" in player_ids(api, crew, bearer(ozgun_session["token"]))
    assert db.fetch_one("SELECT logged_by FROM matches WHERE id = %s", (logged.json()["id"],))["logged_by"] is None

    # the solo league is gone, its photos too
    assert api.get(f"/boards/{alone}").status_code == 404
    assert db.fetch_one("SELECT 1 FROM match_photos WHERE id = %s", (photo["id"],)) is None
    assert not any(f.exists() for f in files)

    # the password board is still there for its password devices, and its admin password claims it again
    assert api.get(board.url("/me"), headers=board.member).status_code == 200
    newcomer = sign_in(api, mail, "newcomer@example.com")
    claimed = api.post(board.url("/claim"), json={"password": "admin-pass"}, headers=bearer(newcomer["token"]))
    assert claimed.status_code == 201


def test_someone_still_asking_to_join_never_inherits(api, mail):
    kerem = sign_in(api, mail, "kerem@example.com")
    slug, admin = league(api, kerem, "Office League")
    api.post(f"/boards/{slug}/players", json={"name": "kerem"}, headers=admin)
    code = api.post(f"/boards/{slug}/invites", json={}, headers=bearer(kerem["token"])).json()["code"]
    stranger = sign_in(api, mail, "stranger@example.com")
    asked = api.post(f"/invites/{code}/accept", json={"newName": "Stranger"}, headers=bearer(stranger["token"]))
    assert asked.status_code == 200, asked.text
    assert api.get("/auth/me/deletion", headers=bearer(kerem["token"])).json()[0]["fate"] == "delete"


def test_deleting_needs_the_account(api, mail, board):
    assert api.delete("/auth/me").status_code == 401
    assert api.delete("/auth/me", headers=board.admin).status_code == 401
    assert api.get("/auth/me/deletion").status_code == 401
