"""Accounts: sign-in links by e-mail, account tokens, and the switch that keeps it all off by default."""

from conftest import bearer, sign_in


def test_off_unless_switched_on(api, monkeypatch):
    monkeypatch.delenv("ACCOUNTS", raising=False)
    assert api.get("/auth/config").json() == {"accounts": False}
    assert api.post("/auth/email", json={"email": "kerem@example.com"}).status_code == 404
    # switched on, but with no address for the links or no way to send mail it stays off
    monkeypatch.setenv("ACCOUNTS", "on")
    monkeypatch.delenv("APP_URL", raising=False)
    assert api.get("/auth/config").json() == {"accounts": False}
    monkeypatch.setenv("APP_URL", "https://matchnight.test")
    monkeypatch.delenv("SMTP_HOST", raising=False)
    monkeypatch.delenv("MAIL_LOG_LINKS", raising=False)
    assert api.get("/auth/config").json() == {"accounts": False}


def test_sign_in_with_a_link(api, mail):
    assert api.get("/auth/config").json() == {"accounts": True}
    assert api.post("/auth/email", json={"email": "  Kerem@Example.COM ", "lang": "tr"}).status_code == 202
    assert mail[0]["to"] == "kerem@example.com"
    assert mail[0]["lang"] == "tr"
    # the link always points at APP_URL, whatever the request's origin
    assert mail[0]["link"].startswith("https://matchnight.test/#/signin?token=")

    token = mail[0]["link"].split("token=")[1]
    first = api.post("/auth/email/verify", json={"token": token}).json()
    assert first["user"] == {"id": 1, "email": "kerem@example.com", "name": None}
    assert api.get("/auth/me", headers=bearer(first["token"])).json()["email"] == "kerem@example.com"

    # one use only
    assert api.post("/auth/email/verify", json={"token": token}).status_code == 400
    # the same address signs in to the same account
    again = sign_in(api, mail, "kerem@example.com")
    assert again["user"]["id"] == 1


def test_links_expire(api, mail):
    api.post("/auth/email", json={"email": "kerem@example.com"})
    token = mail[0]["link"].split("token=")[1]
    api.app.state.db.execute("UPDATE login_links SET expires_at = NOW() - INTERVAL '1 second'")
    assert api.post("/auth/email/verify", json={"token": token}).status_code == 400
    assert api.post("/auth/email/verify", json={"token": "x" * 43}).status_code == 400


def test_only_hashes_are_stored(api, mail):
    api.post("/auth/email", json={"email": "kerem@example.com"})
    token = mail[0]["link"].split("token=")[1]
    stored = api.app.state.db.fetch_one("SELECT token_hash FROM login_links")["token_hash"]
    assert token not in stored and len(stored) == 64


def test_rename(api, mail):
    session = sign_in(api, mail)
    response = api.patch("/auth/me", json={"name": "  Kerem "}, headers=bearer(session["token"]))
    assert response.json()["name"] == "Kerem"
    assert api.patch("/auth/me", json={"name": ""}, headers=bearer(session["token"])).status_code == 422


def test_account_and_board_tokens_stay_apart(api, mail, board):
    session = sign_in(api, mail)
    assert api.get(board.url("/me"), headers=bearer(session["token"])).status_code == 401
    assert api.get("/auth/me", headers=board.admin).status_code == 401
    assert api.get("/auth/me").status_code == 401


def test_a_bumped_session_version_signs_out(api, mail):
    session = sign_in(api, mail)
    api.app.state.db.execute("UPDATE users SET session_version = session_version + 1")
    assert api.get("/auth/me", headers=bearer(session["token"])).status_code == 401


def test_bad_addresses_and_flooding(api, mail):
    assert api.post("/auth/email", json={"email": "not-an-address"}).status_code == 422
    for _ in range(5):
        assert api.post("/auth/email", json={"email": "kerem@example.com"}).status_code == 202
    assert api.post("/auth/email", json={"email": "KEREM@example.com"}).status_code == 429
    # another address is still fine
    assert api.post("/auth/email", json={"email": "ozgun@example.com"}).status_code == 202


def test_moving_the_account_to_a_new_address(api, mail):
    me = sign_in(api, mail, "kerem@example.com")
    league = api.post("/boards", json={"name": "Office League"}, headers=bearer(me["token"]))
    assert league.status_code == 201
    sign_in(api, mail, "ozgun@example.com")

    def ask(email):
        return api.post("/auth/me/email", json={"email": email, "lang": "tr"}, headers=bearer(me["token"]))

    assert ask("kerem@example.com").status_code == 422
    assert ask("ozgun@example.com").status_code == 409
    # a second request replaces the first
    assert ask("old-idea@example.com").status_code == 202
    first = mail[-1]["link"].split("token=")[1]
    assert ask("kerem@new.example.com").status_code == 202
    assert (mail[-1]["kind"], mail[-1]["to"], mail[-1]["lang"]) == ("change", "kerem@new.example.com", "tr")
    assert mail[-1]["link"].startswith("https://matchnight.test/#/email?token=")
    token = mail[-1]["link"].split("token=")[1]
    assert api.post("/auth/me/email/verify", json={"token": first}).status_code == 400

    moved = api.post("/auth/me/email/verify", json={"token": token})
    assert moved.status_code == 200, moved.text
    assert moved.json()["user"] == {"id": me["user"]["id"], "email": "kerem@new.example.com", "name": None}
    # the old address hears about it
    assert (mail[-1]["kind"], mail[-1]["to"], mail[-1]["email"]) == (
        "changed",
        "kerem@example.com",
        "kerem@new.example.com",
    )
    # once only
    assert api.post("/auth/me/email/verify", json={"token": token}).status_code == 400

    # same account, leagues and all; tokens from before still work
    assert api.get("/auth/me", headers=bearer(me["token"])).json()["email"] == "kerem@new.example.com"
    [owned] = api.get("/auth/boards", headers=bearer(moved.json()["token"])).json()
    assert (owned["slug"], owned["role"]) == ("office-league", "owner")
    # the old address is free again: signing in with it makes a new, empty account
    other = sign_in(api, mail, "kerem@example.com")
    assert other["user"]["id"] != me["user"]["id"]
    assert api.get("/auth/boards", headers=bearer(other["token"])).json() == []
