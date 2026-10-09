import pytest
from conftest import ADMIN_KEY, ADMIN_PW, MEMBER_PW, Board

SINCE_EVER = {"start_time": "2000-01-01"}


def test_health(api):
    assert api.get("/health").json() == {"ok": True, "version": "dev"}


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


# ----------- Seasons & clubs -----------
def seasons(board):
    return board.api.get(board.url("/seasons"), headers=board.member).json()


def club(season, name):
    return next(c for c in season["clubs"] if c["name"] == name)


def elo(board):
    return board.api.get(board.url("/elo"), headers=board.member).json()


def test_a_new_board_starts_with_the_newest_club_list(board):
    [season] = seasons(board)
    assert (season["name"], season["game"], season["active"], season["matches"]) == ("FC27", "FC27", True, 0)
    assert len(season["clubs"]) == 55
    ratings = [c["elo"] for c in season["clubs"]]
    assert ratings == sorted(ratings, reverse=True)  # strongest first
    assert all(c["eaId"] and c["modelElo"] == c["elo"] and c["adjust"] == 0 for c in season["clubs"])
    assert min(ratings) < 0  # the model rates the weakest clubs below zero


def test_matches_keep_the_club_ratings_they_were_played_with(board):
    api = board.api
    board.add_players("a", "b")
    [season] = seasons(board)
    arsenal, chelsea = club(season, "Arsenal"), club(season, "Chelsea")
    board.add_match(["a"], ["b"], 2, 1, "arsenal", "My Custom FC")
    [first] = api.get(board.url("/matches"), headers=board.member).json()
    # listed clubs are matched case-insensitively; anything else is a custom club at the default rating
    assert (first["club_a"], first["club_a_elo"], first["club_b"], first["club_b_elo"]) == (
        "Arsenal",
        arsenal["elo"],
        "My Custom FC",
        500,
    )
    before = elo(board)

    url = board.url(f"/seasons/{season['id']}/clubs/{arsenal['id']}")
    assert api.patch(url, json={"elo": 600}, headers=board.admin).json()["elo"] == 600
    assert elo(board) == before  # history is untouched

    board.add_match(["a"], ["b"], 2, 1, "Arsenal", "Chelsea")
    latest = api.get(board.url("/matches"), headers=board.member).json()[0]
    assert (latest["club_a_elo"], latest["club_b_elo"], latest["season_id"]) == (600, chelsea["elo"], season["id"])
    assert seasons(board)[0]["matches"] == 2


def test_a_new_season_is_prepared_aside_and_then_activated(board):
    api = board.api
    board.add_players("a", "b")
    board.add_match(["a"], ["b"], 3, 0)
    [current] = seasons(board)
    before = elo(board)

    body = {"name": " FC28 ", "copyFrom": current["id"]}
    created = api.post(board.url("/seasons"), json=body, headers=board.admin)
    assert created.status_code == 201
    draft = created.json()
    assert (draft["name"], draft["active"], draft["matches"], draft["game"]) == ("FC28", False, 0, "FC27")
    assert draft["clubs"] == [c | {"id": club(draft, c["name"])["id"]} for c in current["clubs"]]
    clubs = board.url(f"/seasons/{draft['id']}/clubs")

    # edit the draft: re-rate, add and drop clubs
    arsenal = f"{clubs}/{club(draft, 'Arsenal')['id']}"
    assert api.patch(arsenal, json={"elo": 1300}, headers=board.admin).status_code == 200
    added = api.post(clubs, json={"name": "Trabzonspor", "elo": 700}, headers=board.admin)
    assert added.status_code == 201 and added.json()["name"] == "Trabzonspor"
    chelsea = f"{clubs}/{club(draft, 'Chelsea')['id']}"
    assert api.delete(chelsea, headers=board.admin).status_code == 200
    assert api.delete(chelsea, headers=board.admin).status_code == 404

    # nothing changes until it is activated, and the old season stays as it was
    old, edited = seasons(board)
    assert old == current and len(edited["clubs"]) == 55 and elo(board) == before
    activated = api.patch(board.url(f"/seasons/{draft['id']}"), json={"active": True}, headers=board.admin)
    assert activated.json()["active"] is True
    assert [s["active"] for s in seasons(board)] == [False, True]
    assert elo(board) == before

    board.add_match(["a"], ["b"], 1, 1, "Arsenal", "Chelsea")  # Chelsea left FC28: a custom club now
    latest = api.get(board.url("/matches"), headers=board.member).json()[0]
    assert (latest["season_id"], latest["club_a_elo"], latest["club_b_elo"]) == (draft["id"], 1300, 500)


def test_the_model_rates_a_draft_and_keeps_corrections(board):
    api = board.api
    [current] = seasons(board)
    draft = api.post(board.url("/seasons"), json={"name": "FC28", "copyFrom": current["id"]}, headers=board.admin)
    draft = draft.json()
    arsenal, chelsea = club(draft, "Arsenal"), club(draft, "Chelsea")

    # a correction on a model-rated club is kept apart from the model's rating
    url = board.url(f"/seasons/{draft['id']}/clubs/{arsenal['id']}")
    corrected = api.patch(url, json={"elo": arsenal["modelElo"] + 40}, headers=board.admin).json()
    assert (corrected["elo"], corrected["adjust"]) == (arsenal["modelElo"] + 40, 40)

    model = {"v": 2, "benchW": 0.5}
    body = {
        "game": "fc28",
        "model": model,
        "clubs": [
            {"eaId": arsenal["eaId"], "name": "Arsenal", "modelElo": 1000},
            {"eaId": chelsea["eaId"], "name": "Chelsea", "modelElo": -150},
            {"eaId": 999001, "name": "Brand New FC", "modelElo": 420},
        ],
    }
    rated = api.post(board.url(f"/seasons/{draft['id']}/model"), json=body, headers=board.admin)
    assert rated.status_code == 200, rated.text
    rated = rated.json()
    assert (rated["game"], rated["model"]) == ("FC28", model)
    assert club(rated, "Arsenal") | {"id": 0} == {
        "id": 0, "name": "Arsenal", "elo": 1040, "eaId": arsenal["eaId"], "modelElo": 1000, "adjust": 40,
    }  # fmt: skip
    assert (club(rated, "Chelsea")["elo"], club(rated, "Brand New FC")["elo"]) == (-150, 420)
    assert len(rated["clubs"]) == 56  # clubs the model didn't mention stay

    # only drafts: the active season keeps its ratings until an admin edits them
    active = board.url(f"/seasons/{current['id']}/model")
    assert api.post(active, json=body, headers=board.admin).status_code == 409
    assert api.post(board.url(f"/seasons/{draft['id']}/model"), json=body, headers=board.member).status_code == 403


def test_the_model_adopts_clubs_entered_by_hand(board):
    api = board.api
    draft = api.post(board.url("/seasons"), json={"name": "Draft"}, headers=board.admin).json()
    clubs = board.url(f"/seasons/{draft['id']}/clubs")
    api.post(clubs, json={"name": "Arsenal", "elo": 900}, headers=board.admin)
    body = {"game": "FC27", "model": {}, "clubs": [{"eaId": 1, "name": "ARSENAL", "modelElo": 950}]}
    [arsenal] = api.post(board.url(f"/seasons/{draft['id']}/model"), json=body, headers=board.admin).json()["clubs"]
    assert (arsenal["name"], arsenal["eaId"], arsenal["elo"], arsenal["adjust"]) == ("Arsenal", 1, 950, 0)

    twice = body | {"clubs": body["clubs"] * 2}
    assert api.post(board.url(f"/seasons/{draft['id']}/model"), json=twice, headers=board.admin).status_code == 422


def test_only_unplayed_inactive_seasons_can_be_deleted(board):
    api = board.api
    board.add_players("a", "b")
    board.add_match(["a"], ["b"], 1, 0)
    [first] = seasons(board)
    draft = api.post(board.url("/seasons"), json={"name": "Draft"}, headers=board.admin).json()
    assert draft["clubs"] == [] and draft["game"] is None
    assert api.delete(board.url(f"/seasons/{first['id']}"), headers=board.admin).status_code == 409  # active

    api.patch(board.url(f"/seasons/{draft['id']}"), json={"active": True}, headers=board.admin)
    assert api.delete(board.url(f"/seasons/{first['id']}"), headers=board.admin).status_code == 409  # has matches
    api.patch(board.url(f"/seasons/{first['id']}"), json={"active": True}, headers=board.admin)
    assert api.delete(board.url(f"/seasons/{draft['id']}"), headers=board.admin).status_code == 200
    assert [s["name"] for s in seasons(board)] == [first["name"]]


def test_season_and_club_names_are_unique_and_ratings_bounded(board):
    api = board.api
    [first] = seasons(board)
    clubs = board.url(f"/seasons/{first['id']}/clubs")
    assert api.post(board.url("/seasons"), json={"name": first["name"].lower()}, headers=board.admin).status_code == 409
    assert api.post(clubs, json={"name": "ARSENAL", "elo": 900}, headers=board.admin).status_code == 409
    chelsea = club(first, "Chelsea")
    url = f"{clubs}/{chelsea['id']}"
    assert api.patch(url, json={"name": "arsenal"}, headers=board.admin).status_code == 409
    assert api.post(clubs, json={"name": "New FC", "elo": 3001}, headers=board.admin).status_code == 422
    assert api.post(clubs, json={"name": "Low FC", "elo": -1001}, headers=board.admin).status_code == 422
    assert api.post(clubs, json={"name": "  ", "elo": 500}, headers=board.admin).status_code == 422
    assert api.patch(url, json={}, headers=board.admin).status_code == 422
    renamed = api.patch(url, json={"name": "Chelsea FC"}, headers=board.admin)
    assert renamed.json() == chelsea | {"name": "Chelsea FC"}
    sunday = api.post(clubs, json={"name": "Sunday League", "elo": -200}, headers=board.admin).json()
    assert (sunday["elo"], sunday["eaId"], sunday["modelElo"], sunday["adjust"]) == (-200, None, None, 0)


def test_seasons_are_admin_only_and_stay_inside_their_board(api, board):
    [first] = seasons(board)
    clubs = board.url(f"/seasons/{first['id']}/clubs")
    assert api.post(board.url("/seasons"), json={"name": "FC28"}, headers=board.member).status_code == 403
    assert api.patch(board.url(f"/seasons/{first['id']}"), json={"name": "x"}, headers=board.member).status_code == 403
    assert api.post(clubs, json={"name": "New FC", "elo": 500}, headers=board.member).status_code == 403
    assert api.get(board.url("/seasons")).status_code == 401

    other = Board(api, "Other Crew")
    [theirs] = seasons(other)
    assert api.patch(other.url(f"/seasons/{first['id']}"), json={"name": "x"}, headers=other.admin).status_code == 404
    copy = {"name": "Copy", "copyFrom": first["id"]}
    assert api.post(other.url("/seasons"), json=copy, headers=other.admin).status_code == 404
    mine = board.url(f"/seasons/{first['id']}/clubs/{club(theirs, 'Arsenal')['id']}")
    assert api.patch(mine, json={"elo": 1}, headers=board.admin).status_code == 404  # their club, my season


# ----------- The night's plan -----------
def plan(board, *matches, headers=None):
    body = {"rules": {"minPer": 3}, "matches": [{"teamA": a, "teamB": b} for a, b in matches]}
    return board.api.put(board.url("/fixture"), json=body, headers=headers or board.member)


def planned(board):
    return board.api.get(board.url("/fixture"), headers=board.member).json()


def test_recorded_matches_tick_off_the_plan(board):
    api = board.api
    board.add_players("a", "b", "c", "d", "e")
    made = plan(board, (["a", "b"], ["c", "d"]), (["a", "e"], ["b", "c"]), (["a", "b"], ["c", "d"]))
    assert made.status_code == 200, made.text
    assert planned(board) == made.json()
    assert [(m["slot"], m["teamA"], m["teamB"], m["matchId"]) for m in made.json()["matches"]] == [
        (0, ["a", "b"], ["c", "d"], None),
        (1, ["a", "e"], ["b", "c"], None),
        (2, ["a", "b"], ["c", "d"], None),
    ]

    # same sides in any order tick off the first open slot; other line-ups touch nothing
    first = board.add_match(["d", "c"], ["b", "a"], 2, 1).json()["id"]
    board.add_match(["a", "c"], ["b", "d"], 0, 0)
    assert [m["matchId"] for m in planned(board)["matches"]] == [first, None, None]

    # a skipped match isn't ticked off; the next one with the same sides is
    skipped = api.patch(board.url("/fixture/matches/1"), json={"skipped": True}, headers=board.member)
    assert skipped.json()["matches"][1]["skipped"] is True
    board.add_match(["a", "e"], ["b", "c"], 1, 0)
    again = board.add_match(["a", "b"], ["c", "d"], 3, 3).json()["id"]
    assert [m["matchId"] for m in planned(board)["matches"]] == [first, None, again]

    # deleting a match makes its planned match open again
    assert api.delete(board.url(f"/matches/{first}"), headers=board.admin).status_code == 200
    assert planned(board)["matches"][0]["matchId"] is None


def test_one_plan_at_a_time(board):
    board.add_players("a", "b", "c", "d")
    assert planned(board) is None
    plan(board, (["a", "b"], ["c", "d"]))
    newer = plan(board, (["a", "c"], ["b", "d"])).json()
    assert planned(board) == newer and len(newer["matches"]) == 1
    assert board.api.delete(board.url("/fixture"), headers=board.member).status_code == 200
    assert planned(board) is None
    assert board.api.delete(board.url("/fixture"), headers=board.member).status_code == 404
    skip = board.api.patch(board.url("/fixture/matches/0"), json={"skipped": True}, headers=board.member)
    assert skip.status_code == 404


def test_plans_only_hold_the_boards_active_players(api, board):
    board.add_players("a", "b", "c", "d", "gone")
    api.patch(board.url("/players/5"), json={"archived": True}, headers=board.admin)
    assert plan(board, (["a", "b"], ["c", "x"])).status_code == 422  # unknown
    assert plan(board, (["a", "b"], ["c", "gone"])).status_code == 422  # archived
    assert plan(board, (["a", "b"], ["b", "c"])).status_code == 422  # twice in one match
    empty = {"rules": {}, "matches": []}
    assert board.api.put(board.url("/fixture"), json=empty, headers=board.member).status_code == 422
    assert api.get(board.url("/fixture")).status_code == 401

    plan(board, (["a", "b"], ["c", "d"]))
    other = Board(api, "Other Crew")
    assert api.get(other.url("/fixture"), headers=other.member).json() is None
