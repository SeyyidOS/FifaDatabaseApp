import pytest
from conftest import ADMIN_KEY, ADMIN_PW, MEMBER_PW, Board

SINCE_EVER = {"start_time": "2000-01-01"}


def test_health_and_shared_clubs(api):
    assert api.get("/health").json() == {"ok": True}
    clubs = api.get("/clubs").json()
    assert len(clubs) == 45 and all(isinstance(c["elo"], int) for c in clubs)


# ----------- Boards & sign-in -----------
def test_creating_a_board_signs_the_creator_in_as_admin(api):
    created = api.post("/boards", json={"name": "Kerem'in Çocukları", "password": MEMBER_PW, "adminPassword": ADMIN_PW})
    assert created.status_code == 201
    body = created.json()
    assert (body["slug"], body["name"], body["role"]) == ("kerem-in-cocuklari", "Kerem'in Çocukları", "admin")
    me = api.get("/boards/kerem-in-cocuklari/me", headers={"Authorization": f"Bearer {body['token']}"})
    assert me.json() == {"slug": "kerem-in-cocuklari", "name": "Kerem'in Çocukları", "role": "admin", "kFactor": 24}
    assert api.get("/boards/kerem-in-cocuklari").json() == {"slug": "kerem-in-cocuklari", "name": "Kerem'in Çocukları"}


def test_same_board_name_gets_a_different_slug(api):
    assert Board(api, "Friday Night").slug == "friday-night"
    assert Board(api, "Friday Night").slug.startswith("friday-night-")


@pytest.mark.parametrize(
    "body",
    [
        {"name": "X", "password": MEMBER_PW, "adminPassword": ADMIN_PW},  # name too short
        {"name": "Crew", "password": "short", "adminPassword": ADMIN_PW},  # password too short
        {"name": "Crew", "password": MEMBER_PW, "adminPassword": MEMBER_PW},  # same passwords
    ],
)
def test_invalid_boards_are_rejected(api, body):
    assert api.post("/boards", json=body).status_code == 422


def test_board_creation_is_rate_limited(api):
    def create(i):
        return api.post("/boards", json={"name": f"Crew {i}", "password": MEMBER_PW, "adminPassword": ADMIN_PW})

    assert [create(i).status_code for i in range(6)] == [201] * 5 + [429]


def test_login_picks_the_role_from_the_password(board):
    def login(password):
        return board.api.post(board.url("/login"), json={"password": password})

    assert login(MEMBER_PW).json()["role"] == "member"
    assert login(ADMIN_PW).json()["role"] == "admin"
    assert login("nope").status_code == 401
    assert board.api.post("/boards/missing/login", json={"password": MEMBER_PW}).status_code == 404


def test_wrong_passwords_are_rate_limited(board):
    for _ in range(10):
        assert board.api.post(board.url("/login"), json={"password": "nope"}).status_code == 401
    assert board.api.post(board.url("/login"), json={"password": MEMBER_PW}).status_code == 429


def test_board_data_needs_a_valid_token_for_that_board(api, board):
    other = Board(api, "Other Crew")
    tampered = board.member["Authorization"][:-2] + "xx"
    assert api.get(board.url("/players")).status_code == 401
    assert api.get(board.url("/players"), headers={"Authorization": "Bearer garbage"}).status_code == 401
    assert api.get(board.url("/players"), headers={"Authorization": tampered}).status_code == 401
    assert api.get(board.url("/players"), headers=other.admin).status_code == 401  # token of another board
    assert api.get(board.url("/players"), headers=board.member).status_code == 200
    assert api.get("/boards/missing/players", headers=board.member).status_code == 404


def test_server_admin_key_works_on_every_board(board):
    assert board.api.get(board.url("/me"), headers={"X-Admin-Key": ADMIN_KEY}).json()["role"] == "admin"


def test_members_cannot_use_admin_actions(board):
    board.add_players("a", "b")
    board.add_match(["a"], ["b"], 1, 0)
    assert board.api.delete(board.url("/matches/1"), headers=board.member).status_code == 403
    assert board.api.patch(board.url("/players/1"), json={"archived": True}, headers=board.member).status_code == 403
    assert board.api.patch(board.url(""), json={"kFactor": 30}, headers=board.member).status_code == 403


def test_settings_and_password_changes(board):
    api = board.api
    renamed = api.patch(board.url(""), json={"name": "New Name", "kFactor": 30}, headers=board.admin)
    assert renamed.json()["kFactor"] == 30
    assert api.get(board.url("/me"), headers=board.member).json()["name"] == "New Name"

    # a new board password signs members out; admins stay signed in
    assert api.patch(board.url(""), json={"password": ADMIN_PW}, headers=board.admin).status_code == 422
    assert api.patch(board.url(""), json={"password": "fresh-member"}, headers=board.admin).status_code == 200
    assert api.get(board.url("/me"), headers=board.member).status_code == 401
    assert api.post(board.url("/login"), json={"password": "fresh-member"}).json()["role"] == "member"

    # a new admin password signs other admin devices out, but the caller gets a fresh token
    changed = api.patch(board.url(""), json={"adminPassword": "fresh-admin"}, headers=board.admin)
    assert api.get(board.url("/me"), headers=board.admin).status_code == 401
    fresh = {"Authorization": f"Bearer {changed.json()['token']}"}
    assert api.get(board.url("/me"), headers=fresh).json()["role"] == "admin"


# ----------- Players -----------
def test_player_names_are_normalised_and_unique_per_board(api, board):
    created = api.post(board.url("/players"), json={"name": "  Ali   VELI "}, headers=board.member)
    assert created.status_code == 201 and created.json() == {"id": 1, "name": "ali veli", "archived": False}
    assert api.post(board.url("/players"), json={"name": "ALI veli"}, headers=board.member).status_code == 409
    other = Board(api, "Other Crew")
    assert api.post(other.url("/players"), json={"name": "ali veli"}, headers=other.member).status_code == 201


@pytest.mark.parametrize("name", ["", "   ", "a&b", "x" * 31, "{x}", "a,b"])
def test_invalid_player_names_are_rejected(board, name):
    assert board.api.post(board.url("/players"), json={"name": name}, headers=board.member).status_code == 422


def test_archiving_keeps_history_and_ratings(board):
    api = board.api
    board.add_players("a", "b", "c")
    board.add_match(["a"], ["b"], 3, 0)
    board.add_match(["b"], ["c"], 1, 2)
    before = api.get(board.url("/elo"), headers=board.member).json()

    assert api.patch(board.url("/players/1"), json={"archived": True}, headers=board.admin).json()["archived"] is True
    assert api.get(board.url("/elo"), headers=board.member).json() == before  # nobody's rating moves
    assert len(api.get(board.url("/matches"), headers=board.member).json()) == 2
    standings = api.get(board.url("/leaderboard/players"), params=SINCE_EVER, headers=board.member).json()
    assert "a" not in [r["name"] for r in standings]
    assert board.add_match(["a"], ["c"], 1, 0).status_code == 422  # archived players can't play
    readded = api.post(board.url("/players"), json={"name": "a"}, headers=board.member)
    assert readded.status_code == 409 and readded.json()["detail"].endswith("Settings")

    assert api.patch(board.url("/players/1"), json={"archived": False}, headers=board.admin).json()["archived"] is False


def test_only_players_without_matches_can_be_deleted(board):
    board.add_players("a", "b", "typo")
    board.add_match(["a"], ["b"], 1, 0)
    assert board.api.delete(board.url("/players/1"), headers=board.admin).status_code == 409
    assert board.api.delete(board.url("/players/3"), headers=board.admin).status_code == 200
    assert board.api.delete(board.url("/players/3"), headers=board.admin).status_code == 404


def test_renaming_a_player_updates_their_history(board):
    board.add_players("a", "b")
    board.add_match(["a"], ["b"], 1, 0)
    assert board.api.patch(board.url("/players/1"), json={"name": "Alpha"}, headers=board.admin).status_code == 200
    assert board.api.get(board.url("/matches"), headers=board.member).json()[0]["team_a"] == ["alpha"]
    assert board.api.patch(board.url("/players/1"), json={"name": "b"}, headers=board.admin).status_code == 409


# ----------- Matches -----------
def test_invalid_matches_are_rejected(board):
    board.add_players("a", "b", "c", "d")
    assert board.add_match(["a", "x"], ["c", "d"], 1, 0).status_code == 422  # unknown player
    assert board.add_match(["a", "b"], ["b", "c"], 1, 0).status_code == 422  # on both sides
    assert board.add_match(["a", "a"], ["c", "d"], 1, 0).status_code == 422  # listed twice
    assert board.add_match([], ["c", "d"], 1, 0).status_code == 422  # empty side
    assert board.add_match(["a"], ["c"], -1, 0).status_code == 422  # negative score
    assert board.add_match(["a"], ["c"], 1, 0, club_a="  ").status_code == 422  # no club
    assert board.api.get(board.url("/matches"), headers=board.member).json() == []


def test_matches_keep_team_order_and_stay_inside_their_board(api, board):
    board.add_players("a", "b", "c", "d")
    created = board.add_match(["B", "a"], ["c", "d"], 3, 1)
    assert created.status_code == 201
    stored = api.get(board.url("/matches"), headers=board.member).json()[0]
    assert (stored["team_a"], stored["team_b"], stored["score_a"], stored["score_b"]) == (["b", "a"], ["c", "d"], 3, 1)

    other = Board(api, "Other Crew")
    match_id = created.json()["id"]
    assert api.get(other.url("/matches"), headers=other.member).json() == []
    assert api.delete(other.url(f"/matches/{match_id}"), headers=other.admin).status_code == 404
    assert api.delete(board.url(f"/matches/{match_id}"), headers=board.admin).status_code == 200


def test_leaderboards(board):
    board.add_players("a", "b", "c", "d")
    board.add_match(["a", "b"], ["c", "d"], 3, 1, "Arsenal", "Chelsea")
    board.add_match(["a", "c"], ["b", "d"], 2, 2, "Arsenal", "Liverpool")

    def get(kind, start_time="2000-01-01"):
        url = board.url(f"/leaderboard/{kind}")
        return board.api.get(url, params={"start_time": start_time}, headers=board.member)

    players = {r["name"]: r for r in get("players").json()}
    assert (players["a"]["wins"], players["a"]["draws"], players["a"]["points"]) == (1, 1, 4)
    assert players["a"]["win_percentage"] == 50.0
    assert (players["d"]["losses"], players["d"]["goals_forwarded"], players["d"]["goals_accepted"]) == (1, 3, 5)

    clubs = {r["club"]: r for r in get("clubs").json()}
    assert (clubs["Arsenal"]["total_matches"], clubs["Arsenal"]["goals_forwarded"]) == (2, 5)

    duos = {r["duo"]: r for r in get("duos").json()}
    assert set(duos) == {"a & b", "c & d", "a & c", "b & d"} and duos["a & b"]["wins"] == 1

    assert get("players", start_time="2999-01-01").json() == []
    assert get("nonsense").status_code == 422


def test_elo_survives_custom_and_repeated_clubs(board):
    board.add_players("a", "b")
    board.add_match(["a"], ["b"], 3, 0, "Arsenal", "Arsenal")
    board.add_match(["b"], ["a"], 1, 1, "My Custom FC", "Chelsea")
    response = board.api.get(board.url("/elo"), headers=board.member)
    ratings = {r["playerId"]: r["elo"] for r in response.json()["ratings"]}
    assert ratings[1] > 1000 > ratings[2]
    assert ratings[1] + ratings[2] in (1999, 2000, 2001)  # zero-sum up to rounding
