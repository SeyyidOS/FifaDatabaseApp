"""Memberships: owning a board with an account, entering it with the account, and saying who you are."""

from conftest import ADMIN_PW, MEMBER_PW, bearer, sign_in


def test_creating_a_board_while_signed_in_makes_you_its_owner(api, mail):
    me = sign_in(api, mail)
    created = api.post(
        "/boards",
        json={"name": "Office League", "password": MEMBER_PW, "adminPassword": ADMIN_PW},
        headers=bearer(me["token"]),
    )
    assert created.status_code == 201, created.text
    boards = api.get("/auth/boards", headers=bearer(me["token"])).json()
    assert boards == [
        {"slug": "office-league", "name": "Office League", "role": "owner", "pending": 0, "player": None, "asked": None}
    ]


def test_creating_a_board_without_accounts_ignores_the_header(api, monkeypatch):
    monkeypatch.delenv("ACCOUNTS", raising=False)
    created = api.post(
        "/boards",
        json={"name": "Office League", "password": MEMBER_PW, "adminPassword": ADMIN_PW},
        headers=bearer("not-a-token"),
    )
    assert created.status_code == 201


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
