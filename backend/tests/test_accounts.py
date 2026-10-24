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
    assert first["user"] == {"id": 1, "email": "kerem@example.com", "name": None, "photo": None}
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
    assert moved.json()["user"] == {
        "id": me["user"]["id"],
        "email": "kerem@new.example.com",
        "name": None,
        "photo": None,
    }
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


def test_sign_in_with_the_code(api, mail):
    assert api.post("/auth/email", json={"email": "kerem@example.com", "lang": "tr"}).status_code == 202
    code = mail[-1]["code"]
    assert len(code) == 6 and code.isdigit()
    assert api.post("/auth/email/code", json={"email": "kerem@example.com", "code": "12345"}).status_code == 422
    # the code belongs to its address
    assert api.post("/auth/email/code", json={"email": "ozgun@example.com", "code": code}).status_code == 400

    signed = api.post("/auth/email/code", json={"email": "kerem@example.com", "code": code})
    assert signed.status_code == 200, signed.text
    assert signed.json()["user"]["email"] == "kerem@example.com"
    assert api.get("/auth/me", headers=bearer(signed.json()["token"])).status_code == 200
    # once: neither the code nor the link from that e-mail works again
    assert api.post("/auth/email/code", json={"email": "kerem@example.com", "code": code}).status_code == 400
    assert api.post("/auth/email/verify", json={"token": mail[-1]["link"].split("token=")[1]}).status_code == 400


def test_a_code_allows_a_few_wrong_guesses(api, mail):
    api.post("/auth/email", json={"email": "kerem@example.com"})
    code = mail[-1]["code"]
    wrong = f"{(int(code) + 1) % 10**6:06d}"
    for _ in range(5):
        assert api.post("/auth/email/code", json={"email": "kerem@example.com", "code": wrong}).status_code == 400
    # spent: now even the right code is refused; a new e-mail brings a new one
    assert api.post("/auth/email/code", json={"email": "kerem@example.com", "code": code}).status_code == 400
    api.post("/auth/email", json={"email": "kerem@example.com"})
    assert (
        api.post("/auth/email/code", json={"email": "kerem@example.com", "code": mail[-1]["code"]}).status_code == 200
    )


def test_a_token_in_use_is_renewed(api, mail):
    import json
    import time

    import auth

    me = sign_in(api, mail)
    assert "renewed" not in api.get("/auth/me", headers=bearer(me["token"])).json()
    # the same account, signed in two days ago
    payload = {"k": "user", "u": me["user"]["id"], "v": 1, "iat": int(time.time()) - 2 * 86400}
    body = auth._b64(json.dumps(payload, separators=(",", ":")).encode())
    renewed = api.get("/auth/me", headers=bearer(f"{body}.{auth._sign(body)}")).json()["renewed"]
    assert auth.read_user_token(renewed)["iat"] > time.time() - 60


def test_app_reviews_demo_account_signs_in_with_its_fixed_code(api, mail, monkeypatch):
    monkeypatch.setenv("REVIEW_EMAIL", "Review@Matchnight.test")
    monkeypatch.setenv("REVIEW_CODE", "246810")
    assert api.post("/auth/email", json={"email": "review@matchnight.test"}).status_code == 202
    # no e-mail goes out: nobody would read it
    assert mail == []
    signed = api.post("/auth/email/code", json={"email": "review@matchnight.test", "code": "246810"})
    assert signed.status_code == 200, signed.text
    assert signed.json()["user"]["email"] == "review@matchnight.test"
    # the code is spent like any other, until the app asks for a new one
    assert api.post("/auth/email/code", json={"email": "review@matchnight.test", "code": "246810"}).status_code == 400

    # everyone else still gets a random code by e-mail, and the review code doesn't open their account
    api.post("/auth/email", json={"email": "kerem@example.com"})
    assert mail[-1]["to"] == "kerem@example.com" and mail[-1]["code"] != "246810"
    assert api.post("/auth/email/code", json={"email": "kerem@example.com", "code": "246810"}).status_code == 400

    # without a proper code set, the address is an ordinary one
    monkeypatch.setenv("REVIEW_CODE", "12")
    api.post("/auth/email", json={"email": "review@matchnight.test"})
    assert mail[-1]["to"] == "review@matchnight.test"


def test_an_e_mail_that_could_not_go_out_says_so(api, mail, monkeypatch):
    import mailer

    def refuse(kind, to, lang, **fields):
        raise mailer.MailError("550 daily sending quota exceeded")

    monkeypatch.setattr(mailer, "send_mail", refuse)
    refused = api.post("/auth/email", json={"email": "kerem@example.com", "lang": "tr"})
    assert refused.status_code == 503
    assert refused.json()["detail"] == "Couldn't send the e-mail; try again in a while"
    # no link was left behind that nobody received
    assert api.app.state.db.fetch_one("SELECT COUNT(*) AS n FROM login_links")["n"] == 0
    # the same for an address without an account and one with: nothing to tell them apart
    assert api.post("/auth/email", json={"email": "nobody@example.com"}).status_code == 503


def test_a_refused_e_mail_change_says_so(api, mail, monkeypatch):
    import mailer

    session = sign_in(api, mail)

    def refuse(kind, to, lang, **fields):
        raise mailer.MailError("connection refused")

    monkeypatch.setattr(mailer, "send_mail", refuse)
    moved = api.post("/auth/me/email", json={"email": "new@example.com"}, headers=bearer(session["token"]))
    assert moved.status_code == 503
    assert api.app.state.db.fetch_one("SELECT COUNT(*) AS n FROM email_changes")["n"] == 0


def test_refused_e_mails_still_count_against_the_limits(api, mail, monkeypatch):
    import mailer

    def refuse(kind, to, lang, **fields):
        raise mailer.MailError("down")

    monkeypatch.setattr(mailer, "send_mail", refuse)
    for _ in range(5):
        assert api.post("/auth/email", json={"email": "kerem@example.com"}).status_code == 503
    assert api.post("/auth/email", json={"email": "kerem@example.com"}).status_code == 429
