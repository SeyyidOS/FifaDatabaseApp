"""Invites: personal links for one player, the group link with approval, and managing members."""

from conftest import ADMIN_PW, bearer, sign_in


def owned_board(api, mail, board):
    """The board, owned by kerem's account, with four players who have played."""
    board.add_players("kerem", "ozgun", "seyyid", "bedirhan")
    board.add_match(["kerem", "ozgun"], ["seyyid", "bedirhan"], 3, 1)
    owner = sign_in(api, mail, "kerem@example.com")
    assert api.post(board.url("/claim"), json={"password": ADMIN_PW}, headers=bearer(owner["token"])).status_code == 201
    ids = {p["name"]: p["id"] for p in api.get(board.url("/players"), headers=board.member).json()}
    api.put(board.url("/membership/player"), json={"playerId": ids["kerem"]}, headers=bearer(owner["token"]))
    return owner, ids


def test_a_personal_link_makes_you_that_player(api, mail, board):
    owner, ids = owned_board(api, mail, board)
    made = api.post(board.url("/invites"), json={"playerId": ids["ozgun"]}, headers=bearer(owner["token"]))
    assert made.status_code == 201, made.text
    code = made.json()["code"]
    # asking again gives the same link while it is good
    again = api.post(board.url("/invites"), json={"playerId": ids["ozgun"]}, headers=bearer(owner["token"]))
    assert again.json()["code"] == code

    # anyone with the link sees who it is for, without signing in
    preview = api.get(f"/invites/{code}").json()
    assert preview["kind"] == "personal"
    assert preview["player"]["name"] == "ozgun" and preview["player"]["played"] == 1
    assert preview["board"] == {"name": "Kerem's Crew", "players": 4, "matches": 1}

    ozgun = sign_in(api, mail, "ozgun@example.com")
    accepted = api.post(f"/invites/{code}/accept", json={}, headers=bearer(ozgun["token"]))
    assert accepted.json() == {"slug": board.slug, "status": "joined"}
    [mine] = api.get("/auth/boards", headers=bearer(ozgun["token"])).json()
    assert (mine["role"], mine["player"]["name"]) == ("player", "ozgun")
    # one use only, and ozgun no longer needs a link
    assert api.get(f"/invites/{code}").status_code == 404
    listed = api.get(board.url("/invites"), headers=bearer(owner["token"])).json()
    assert [p["name"] for p in listed["players"]] == ["bedirhan", "seyyid"]
    assert (
        api.post(board.url("/invites"), json={"playerId": ids["ozgun"]}, headers=bearer(owner["token"])).status_code
        == 409
    )


def test_the_group_link_asks_for_approval(api, mail, board):
    owner, ids = owned_board(api, mail, board)
    code = api.post(board.url("/invites"), json={}, headers=bearer(owner["token"])).json()["code"]
    preview = api.get(f"/invites/{code}").json()
    assert preview["kind"] == "group"
    # kerem is taken; the rest are free to pick
    assert sorted(p["name"] for p in preview["players"]) == ["bedirhan", "ozgun", "seyyid"]

    seyyid = sign_in(api, mail, "seyyid@example.com")
    asked = api.post(f"/invites/{code}/accept", json={"playerId": ids["seyyid"]}, headers=bearer(seyyid["token"]))
    assert asked.json()["status"] == "requested"
    # in the board already, as a player without a player yet
    [mine] = api.get("/auth/boards", headers=bearer(seyyid["token"])).json()
    assert (mine["role"], mine["player"], mine["asked"]) == ("player", None, {"name": "seyyid", "new": False})
    assert api.get("/auth/boards", headers=bearer(owner["token"])).json()[0]["pending"] == 1

    newcomer = sign_in(api, mail, "arda@example.com")
    api.post(f"/invites/{code}/accept", json={"newName": "Arda"}, headers=bearer(newcomer["token"]))
    members = api.get(board.url("/members"), headers=bearer(owner["token"])).json()
    assert [(r["email"], r["player"] and r["player"]["name"], r["newName"]) for r in members["requests"]] == [
        ("seyyid@example.com", "seyyid", None),
        ("arda@example.com", None, "arda"),
    ]

    for r in members["requests"]:
        assert api.post(board.url(f"/requests/{r['id']}/approve"), headers=bearer(owner["token"])).status_code == 200
    [mine] = api.get("/auth/boards", headers=bearer(seyyid["token"])).json()
    assert (mine["player"]["name"], mine["asked"]) == ("seyyid", None)
    assert api.get("/auth/boards", headers=bearer(newcomer["token"])).json()[0]["player"]["name"] == "arda"
    assert "arda" in [p["name"] for p in api.get(board.url("/players"), headers=board.member).json()]

    # the link keeps working until it is reset
    reset = api.post(board.url("/invites/group/reset"), headers=bearer(owner["token"])).json()["code"]
    assert reset != code and api.get(f"/invites/{code}").status_code == 404


def test_a_taken_player_cant_be_picked_or_approved_twice(api, mail, board):
    owner, ids = owned_board(api, mail, board)
    code = api.post(board.url("/invites"), json={}, headers=bearer(owner["token"])).json()["code"]
    a = sign_in(api, mail, "a@example.com")
    b = sign_in(api, mail, "b@example.com")
    assert (
        api.post(f"/invites/{code}/accept", json={"playerId": ids["kerem"]}, headers=bearer(a["token"])).status_code
        == 409
    )
    api.post(f"/invites/{code}/accept", json={"playerId": ids["ozgun"]}, headers=bearer(a["token"]))
    api.post(f"/invites/{code}/accept", json={"playerId": ids["ozgun"]}, headers=bearer(b["token"]))
    first, second = api.get(board.url("/members"), headers=bearer(owner["token"])).json()["requests"]
    assert api.post(board.url(f"/requests/{first['id']}/approve"), headers=bearer(owner["token"])).status_code == 200
    assert api.post(board.url(f"/requests/{second['id']}/approve"), headers=bearer(owner["token"])).status_code == 409
    # rejecting leaves them in the board without a player
    assert api.post(board.url(f"/requests/{second['id']}/reject"), headers=bearer(owner["token"])).status_code == 200


def test_roles_and_removal(api, mail, board):
    owner, ids = owned_board(api, mail, board)
    code = api.post(board.url("/invites"), json={"playerId": ids["ozgun"]}, headers=bearer(owner["token"])).json()[
        "code"
    ]
    ozgun = sign_in(api, mail, "ozgun@example.com")
    api.post(f"/invites/{code}/accept", json={}, headers=bearer(ozgun["token"]))
    members = api.get(board.url("/members"), headers=bearer(owner["token"])).json()["members"]
    assert [(m["role"], m["player"]["name"]) for m in members] == [("owner", "kerem"), ("player", "ozgun")]
    oz = members[1]["userId"]

    # players can't manage; the owner makes admins
    assert api.get(board.url("/members"), headers=bearer(ozgun["token"])).status_code == 403
    as_player = bearer(api.post(board.url("/session"), headers=bearer(ozgun["token"])).json()["token"])
    assert api.get(board.url("/players"), headers=as_player).status_code == 200
    assert (
        api.patch(board.url(f"/members/{oz}"), json={"role": "admin"}, headers=bearer(owner["token"])).status_code
        == 200
    )
    # the board token from before the new role gives way to one with it
    assert api.get(board.url("/players"), headers=as_player).status_code == 401
    session = api.post(board.url("/session"), headers=bearer(ozgun["token"])).json()
    assert session["role"] == "admin"
    as_admin = bearer(session["token"])
    assert api.get(board.url("/players"), headers=as_admin).status_code == 200
    # an admin can't touch the owner or change roles
    me = members[0]["userId"]
    assert (
        api.patch(board.url(f"/members/{me}"), json={"role": "player"}, headers=bearer(ozgun["token"])).status_code
        == 403
    )
    assert api.delete(board.url(f"/members/{me}"), headers=bearer(ozgun["token"])).status_code == 404

    assert api.delete(board.url(f"/members/{oz}"), headers=bearer(owner["token"])).status_code == 200
    assert api.get("/auth/boards", headers=bearer(ozgun["token"])).json() == []
    # removed means out: the board token opened with the account stops working too
    assert api.get(board.url("/players"), headers=as_admin).status_code == 401
    # ozgun's player and matches stay
    assert "ozgun" in [p["name"] for p in api.get(board.url("/players"), headers=board.member).json()]


def test_only_owners_and_admins_make_links(api, mail, board):
    owned_board(api, mail, board)
    stranger = sign_in(api, mail, "stranger@example.com")
    assert api.post(board.url("/invites"), json={}, headers=bearer(stranger["token"])).status_code == 403
    assert api.get("/invites/not-a-code").status_code == 404
