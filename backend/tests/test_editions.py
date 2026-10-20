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
