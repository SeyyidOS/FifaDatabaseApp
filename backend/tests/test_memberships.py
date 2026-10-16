"""Memberships: owning a board with an account, entering it with the account, and saying who you are."""

from conftest import ADMIN_KEY, ADMIN_PW, MEMBER_PW, bearer, sign_in


def test_a_league_started_with_an_account_is_yours_and_has_no_passwords(api, mail):
    me = sign_in(api, mail)
    # with accounts on, a new league needs an account, and takes no passwords
    assert api.post("/boards", json={"name": "Office League"}).status_code == 401
    with_passwords = {"name": "Office League", "password": MEMBER_PW, "adminPassword": ADMIN_PW}
    assert api.post("/boards", json=with_passwords, headers=bearer(me["token"])).status_code == 422
    # nobody could get into a league with neither passwords nor an owner
    assert api.post("/boards", json={"name": "Office League"}, headers={"X-Admin-Key": ADMIN_KEY}).status_code == 422

    created = api.post("/boards", json={"name": "Office League"}, headers=bearer(me["token"]))
    assert created.status_code == 201, created.text
    boards = api.get("/auth/boards", headers=bearer(me["token"])).json()
    assert boards == [
        {"slug": "office-league", "name": "Office League", "role": "owner", "pending": 0, "player": None, "asked": None}
    ]
    # the league opens with the account; there is no password to sign in with or to set
    admin = bearer(created.json()["token"])
    assert api.get("/boards/office-league/me", headers=admin).json()["passwordLogin"] is False
    assert api.get("/boards/office-league").json() == {
        "slug": "office-league",
        "name": "Office League",
        "passwordLogin": False,
    }
    assert api.post("/boards/office-league/login", json={"password": MEMBER_PW}).status_code == 403
    assert api.patch("/boards/office-league", json={"password": MEMBER_PW}, headers=admin).status_code == 422


def test_without_accounts_a_board_has_both_passwords(api, monkeypatch):
    monkeypatch.delenv("ACCOUNTS", raising=False)
    assert api.post("/boards", json={"name": "Office League"}).status_code == 422
    assert api.post("/boards", json={"name": "Office League", "password": MEMBER_PW}).status_code == 422
    # an account header changes nothing while accounts are off
    created = api.post(
        "/boards",
        json={"name": "Office League", "password": MEMBER_PW, "adminPassword": ADMIN_PW},
        headers=bearer("not-a-token"),
    )
    assert created.status_code == 201
    assert api.get("/boards/office-league").json()["passwordLogin"] is True


def test_claiming_a_board_with_its_admin_password(api, mail, board):
    me = sign_in(api, mail)
    assert api.post(board.url("/claim"), json={"password": MEMBER_PW}, headers=bearer(me["token"])).status_code == 401
    claimed = api.post(board.url("/claim"), json={"password": ADMIN_PW}, headers=bearer(me["token"]))
    assert claimed.status_code == 201, claimed.text
    assert api.get("/auth/boards", headers=bearer(me["token"])).json()[0]["role"] == "owner"

    # one owner per board
    other = sign_in(api, mail, "ozgun@example.com")
    assert api.post(board.url("/claim"), json={"password": ADMIN_PW}, headers=bearer(other["token"])).status_code == 409
    # and claiming needs an account
    assert api.post(board.url("/claim"), json={"password": ADMIN_PW}).status_code == 401


def test_a_member_enters_the_board_with_the_account(api, mail, board):
    me = sign_in(api, mail)
    assert api.post(board.url("/session"), headers=bearer(me["token"])).status_code == 403
    api.post(board.url("/claim"), json={"password": ADMIN_PW}, headers=bearer(me["token"]))
    session = api.post(board.url("/session"), headers=bearer(me["token"])).json()
    assert (session["slug"], session["role"]) == (board.slug, "admin")
    # an ordinary board token: admin endpoints work with it
    assert api.patch(board.url(""), json={"kFactor": 30}, headers=bearer(session["token"])).status_code == 200
    # and a new admin password signs it out, like any admin device
    api.patch(board.url(""), json={"adminPassword": "brand-new-pass"}, headers=board.admin)
    assert api.get(board.url("/me"), headers=bearer(session["token"])).status_code == 401
    # the account just asks again
    fresh = api.post(board.url("/session"), headers=bearer(me["token"])).json()
    assert api.get(board.url("/me"), headers=bearer(fresh["token"])).status_code == 200


def test_saying_which_player_you_are(api, mail, board):
    board.add_players("kerem", "ozgun", "seyyid", "bedirhan")
    for _ in range(3):
        assert board.add_match(["kerem", "ozgun"], ["seyyid", "bedirhan"], 3, 1).status_code == 201
    ids = {p["name"]: p["id"] for p in api.get(board.url("/players"), headers=board.member).json()}
    me = sign_in(api, mail)
    api.post(board.url("/claim"), json={"password": ADMIN_PW}, headers=bearer(me["token"]))

    linked = api.put(board.url("/membership/player"), json={"playerId": ids["kerem"]}, headers=bearer(me["token"]))
    assert linked.status_code == 200, linked.text
    [mine] = api.get("/auth/boards", headers=bearer(me["token"])).json()
    assert mine["player"]["name"] == "kerem"
    assert mine["player"]["played"] == 3
    assert mine["player"]["rank"] in (1, 2)  # kerem and ozgun won the same matches
    assert mine["player"]["elo"] > 1000
    me_ = mine["player"]
    assert (me_["wins"], me_["draws"], me_["losses"], me_["goals"], me_["form"]) == (3, 0, 0, 9, ["W", "W", "W"])
    night = me_["lastNight"]
    assert (night["played"], night["wins"], night["delta"]) == (3, 3, me_["elo"] - 1000)

    # a player belongs to one account; only owners and admins link themselves for now
    other = sign_in(api, mail, "ozgun@example.com")
    assert (
        api.put(
            board.url("/membership/player"), json={"playerId": ids["kerem"]}, headers=bearer(other["token"])
        ).status_code
        == 403
    )
    assert (
        api.put(board.url("/membership/player"), json={"playerId": 999}, headers=bearer(me["token"])).status_code == 404
    )
    assert (
        api.put(board.url("/membership/player"), json={"playerId": None}, headers=bearer(me["token"])).status_code
        == 200
    )
    assert api.get("/auth/boards", headers=bearer(me["token"])).json()[0]["player"] is None


def test_off_without_accounts(api, mail, board, monkeypatch):
    me = sign_in(api, mail)
    monkeypatch.setenv("ACCOUNTS", "off")
    assert api.post(board.url("/claim"), json={"password": ADMIN_PW}, headers=bearer(me["token"])).status_code == 404
    assert api.get("/auth/boards", headers=bearer(me["token"])).status_code == 404


def test_the_last_night_is_the_players_latest(api, mail, board):
    db = api.app.state.db
    board.add_players("kerem", "ozgun", "seyyid", "bedirhan")
    board.add_match(["kerem", "ozgun"], ["seyyid", "bedirhan"], 3, 1)
    # stored as UTC: 01:30 in Istanbul, so it belongs to the evening before
    db.execute("UPDATE matches SET time = '2026-10-03 22:30:00'")
    ids = {p["name"]: p["id"] for p in api.get(board.url("/players"), headers=board.member).json()}
    me = sign_in(api, mail)
    api.post(board.url("/claim"), json={"password": ADMIN_PW}, headers=bearer(me["token"]))
    api.put(board.url("/membership/player"), json={"playerId": ids["kerem"]}, headers=bearer(me["token"]))
    first = api.get("/auth/boards", headers=bearer(me["token"])).json()[0]["player"]
    assert first["lastNight"]["day"] == "2026-10-03"

    board.add_match(["kerem", "ozgun"], ["seyyid", "bedirhan"], 0, 2)
    board.add_match(["kerem", "seyyid"], ["ozgun", "bedirhan"], 1, 1)
    db.execute("UPDATE matches SET time = '2026-10-10 18:00:00' WHERE time > '2026-10-05'")
    now = api.get("/auth/boards", headers=bearer(me["token"])).json()[0]["player"]
    assert now["form"] == ["W", "L", "D"]
    night = now["lastNight"]
    assert (night["day"], night["played"], night["wins"], night["draws"], night["losses"]) == ("2026-10-10", 2, 0, 1, 1)
    # only that night's Elo
    assert night["delta"] == now["elo"] - first["elo"]
