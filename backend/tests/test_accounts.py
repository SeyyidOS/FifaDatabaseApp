"""Accounts: sign-in links by e-mail, account tokens, and the switch that keeps it all off by default."""

import pytest


@pytest.fixture
def mail(api, monkeypatch):
    """Accounts on, with the e-mails caught here instead of sent."""
    import mailer

    sent: list[dict] = []
    monkeypatch.setenv("ACCOUNTS", "on")
    monkeypatch.setenv("APP_URL", "https://matchnight.test/")
    monkeypatch.setenv("MAIL_LOG_LINKS", "1")
    monkeypatch.setattr(
        mailer,
        "send_login_link",
        lambda to, link, lang, minutes: sent.append({"to": to, "link": link, "lang": lang, "minutes": minutes}),
    )
    return sent


def sign_in(api, mail, email="kerem@example.com"):
    assert api.post("/auth/email", json={"email": email}).status_code == 202
    token = mail[-1]["link"].split("token=")[1]
    response = api.post("/auth/email/verify", json={"token": token})
    assert response.status_code == 200, response.text
    return response.json()


def bearer(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


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
