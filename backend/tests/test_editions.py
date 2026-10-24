"""The classic and store editions (edition.py): the store one never gets what isn't ours to publish."""

STORE = {"X-Edition": "store"}


def test_classic_by_default_store_on_request(board):
    cards = board.url("/games/fc27/cards")
    assert board.api.get(cards, headers=board.member).status_code == 200
    # the store app asks for store on every request
    assert board.api.get(cards, headers={**board.member, **STORE}).status_code == 404
    # and the card model can't rate a season there
    model = board.url("/seasons/1/model")
    assert board.api.post(model, json={}, headers={**board.admin, **STORE}).status_code == 404
    assert board.api.post(model, json={}, headers=board.admin).status_code != 404


def test_a_store_server_never_serves_classic(board, monkeypatch):
    monkeypatch.setenv("EDITION", "store")
    cards = board.url("/games/fc27/cards")
    assert board.api.get(cards, headers=board.member).status_code == 404
    # a request can't ask its way back to classic
    assert board.api.get(cards, headers={**board.member, "X-Edition": "classic"}).status_code == 404
    # everything else works as ever
    assert board.api.get(board.url("/players"), headers=board.member).status_code == 200


def test_only_store_means_store(board, monkeypatch):
    for value in ("", "classic", "Store-ish", "nonsense"):
        monkeypatch.setenv("EDITION", value)
        assert board.api.get(board.url("/games/fc27/cards"), headers=board.member).status_code == 200, value
    monkeypatch.setenv("EDITION", " STORE ")
    assert board.api.get(board.url("/games/fc27/cards"), headers=board.member).status_code == 404


def test_store_sees_no_card_model_in_seasons(board):
    [classic] = board.api.get(board.url("/seasons"), headers=board.member).json()
    assert classic["game"] == "FC27" and classic["clubs"][0]["eaId"] is not None
    [store] = board.api.get(board.url("/seasons"), headers={**board.member, **STORE}).json()
    assert (store["game"], store["model"]) == (None, None)
    assert all(c["eaId"] is None and c["modelElo"] is None and c["adjust"] == 0 for c in store["clubs"])
    # the ratings themselves are the board's own
    assert [c["elo"] for c in store["clubs"]] == [c["elo"] for c in classic["clubs"]]


def test_a_league_started_in_the_store_app_starts_neutral(api, mail):
    from conftest import bearer, sign_in

    me = sign_in(api, mail)
    created = api.post("/boards", json={"name": "Office League"}, headers={**bearer(me["token"]), **STORE})
    admin = {**bearer(created.json()["token"]), **STORE}
    [season] = api.get("/boards/office-league/seasons", headers=admin).json()
    # a football season's name, no game's, and the hand-made starting ratings
    assert season["name"][:4].isdigit() and "–" in season["name"]
    assert len(season["clubs"]) == 50 and {"Real Madrid", "Galatasaray"} <= {c["name"] for c in season["clubs"]}
    row = api.app.state.db.fetch_one("SELECT game FROM seasons")
    assert row["game"] is None


def test_season_label():
    from datetime import date

    from seasons import season_label

    assert season_label(date(2026, 10, 20)) == "2026–27"
    assert season_label(date(2027, 3, 1)) == "2026–27"
    assert season_label(date(2099, 7, 1)) == "2099–00"


def test_the_iphone_app_may_call_the_api(board):
    # its web view asks first: a PUT (a photo, stats) with the store edition's header
    asked = board.api.options(
        board.url("/players"),
        headers={
            "Origin": "capacitor://localhost",
            "Access-Control-Request-Method": "PUT",
            "Access-Control-Request-Headers": "authorization,content-type,x-edition",
        },
    )
    assert asked.status_code == 200, asked.text
    assert "PUT" in asked.headers["access-control-allow-methods"]
    assert "x-edition" in asked.headers["access-control-allow-headers"].lower()
