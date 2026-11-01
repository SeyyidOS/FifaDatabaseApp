"""Keeping people safe from each other: terms, the name filter, reports, blocking, leaving and suspensions."""

import pytest
from conftest import ADMIN_KEY, bearer, sign_in
from test_avatars import picture
from test_invites import owned_board
from test_photos import jpeg, upload

from wordfilter import NOT_ALLOWED, offensive

OPERATOR = {"X-Admin-Key": ADMIN_KEY}


@pytest.mark.parametrize(
    "name",
    ["Siktir Git", "s1kt1r", "SİKTİR", "orospu çocuğu", "oros pu", "f u c k", "F.U.C.K", "fuuuuck", "NIGGER", "amk"],
)
def test_the_filter_catches(name):
    assert offensive(name)


@pytest.mark.parametrize(
    "name",
    [
        "Kerem",
        "Şık Kerem",
        "Özgün",
        "İhsan",
        "Scunthorpe United",
        "Dick Advocaat",
        "Mas Hit",
        "Amina Koyuncu",
        "kıyarak",
    ],
)
def test_the_filter_lets_through(name):
    assert not offensive(name)


def league(api, mail, board):
    """kerem's board, with ozgun in it by a personal link; each with an account and a board token."""
    owner, ids = owned_board(api, mail, board)
    code = api.post(board.url("/invites"), json={"playerId": ids["ozgun"]}, headers=bearer(owner["token"])).json()
    ozgun = sign_in(api, mail, "ozgun@example.com")
    api.post(f"/invites/{code['code']}/accept", json={}, headers=bearer(ozgun["token"]))

    def session(account):
        return bearer(api.post(board.url("/session"), headers=bearer(account["token"])).json()["token"])

    return owner, ozgun, session(owner), session(ozgun), ids


def test_names_people_give_are_filtered(api, mail, board):
    owner, ozgun, kerem_b, _, _ = league(api, mail, board)
    refused = {
        "player": api.post(board.url("/players"), json={"name": "siktir"}, headers=kerem_b),
        "account": api.patch("/auth/me", json={"name": "Orospu"}, headers=bearer(owner["token"])),
        "league": api.patch(board.url(""), json={"name": "fuck this"}, headers=kerem_b),
        "new league": api.post("/boards", json={"name": "amk ligi"}, headers=bearer(ozgun["token"])),
    }
    for what, response in refused.items():
        assert response.status_code == 422, what
        assert NOT_ALLOWED in response.text, what
    assert api.post(board.url("/players"), json={"name": "Şık Kerem"}, headers=kerem_b).status_code == 201


def test_terms_are_agreed_once(api, mail):
    account = sign_in(api, mail)
    assert account["user"]["termsAccepted"] is False
    agreed = api.post("/auth/me/terms", headers=bearer(account["token"]))
    assert agreed.json()["termsAccepted"] is True
    assert api.get("/auth/me", headers=bearer(account["token"])).json()["termsAccepted"] is True


def test_reports_reach_the_operator(api, mail, board, monkeypatch):
    monkeypatch.setenv("SUPPORT_EMAIL", "support@matchnight.test")
    owner, ozgun, kerem_b, ozgun_b, ids = league(api, mail, board)
    match_id = api.get(board.url("/matches"), headers=kerem_b).json()[0]["id"]
    photo = upload(board, match_id, jpeg(), headers=kerem_b).json()["id"]

    sent = api.post(
        board.url("/reports"),
        json={"kind": "photo", "targetId": photo, "reason": "offensive", "note": "not ok"},
        headers=ozgun_b,
    )
    assert sent.status_code == 201, sent.text
    assert (mail[-1]["kind"], mail[-1]["to"], mail[-1]["account"]) == ("report", "support@matchnight.test", 1)
    player = {"kind": "player", "targetId": ids["kerem"], "reason": "harassment"}
    assert api.post(board.url("/reports"), json=player, headers=ozgun_b).status_code == 201
    # what isn't in this board can't be reported from it
    missing = {"kind": "player", "targetId": 999, "reason": "other"}
    assert api.post(board.url("/reports"), json=missing, headers=ozgun_b).status_code == 404

    assert api.get("/admin/reports").status_code == 403
    listed = api.get("/admin/reports", headers=OPERATOR).json()
    assert [(r["kind"], r["subject"], r["accountEmail"]) for r in listed] == [
        ("photo", f"photo {photo} of match {match_id}", "kerem@example.com"),
        ("player", "player 'kerem'", "kerem@example.com"),
    ]
    resolve = api.post(
        f"/admin/reports/{listed[0]['id']}/resolve", json={"resolution": "photo removed"}, headers=OPERATOR
    )
    assert resolve.status_code == 200
    assert len(api.get("/admin/reports", headers=OPERATOR).json()) == 1
    assert len(api.get("/admin/reports?all=true", headers=OPERATOR).json()) == 2


def test_a_viewer_can_report_too(api, mail, board):
    owner, ids = owned_board(api, mail, board)
    code = api.post(board.url("/invites"), json={}, headers=bearer(owner["token"])).json()["code"]
    seyyid = sign_in(api, mail, "seyyid@example.com")
    api.post(f"/invites/{code}/accept", json={"playerId": ids["seyyid"]}, headers=bearer(seyyid["token"]))
    viewer = bearer(api.post(board.url("/session"), headers=bearer(seyyid["token"])).json()["token"])
    report = {"kind": "player", "targetId": ids["bedirhan"], "reason": "impersonation"}
    assert api.post(board.url("/reports"), json=report, headers=viewer).status_code == 201


def test_blocking_hides_their_photos(api, mail, board):
    owner, ozgun, kerem_b, ozgun_b, ids = league(api, mail, board)
    api.put("/auth/me/photo", content=picture(), headers=bearer(owner["token"]))
    match_id = api.get(board.url("/matches"), headers=kerem_b).json()[0]["id"]
    photo = upload(board, match_id, jpeg(), headers=kerem_b).json()["id"]

    def kerem_as_seen_by(headers):
        return next(p for p in api.get(board.url("/players"), headers=headers).json() if p["name"] == "kerem")

    def photos_seen_by(headers):
        return api.get(board.url(f"/matches/{match_id}/photos"), headers=headers).json()

    assert api.put(board.url(f"/players/{ids['kerem']}/block"), headers=ozgun_b).json() == {"blocked": True}
    seen = kerem_as_seen_by(ozgun_b)
    assert (seen["photo"], seen["account"], seen["blocked"]) == (None, True, True)
    assert photos_seen_by(ozgun_b) == []
    assert api.get(board.url("/matches"), headers=ozgun_b).json()[0]["photos"] == []
    # everyone else still sees them
    assert kerem_as_seen_by(board.member)["photo"] is not None
    assert [p["id"] for p in photos_seen_by(board.member)] == [photo]

    # not yourself, not a player without an account, not without an account of your own
    assert api.put(board.url(f"/players/{ids['ozgun']}/block"), headers=ozgun_b).status_code == 422
    assert api.put(board.url(f"/players/{ids['seyyid']}/block"), headers=ozgun_b).status_code == 404
    assert api.put(board.url(f"/players/{ids['kerem']}/block"), headers=board.member).status_code == 403

    assert api.get("/auth/me/blocks", headers=bearer(ozgun["token"])).json() == [{"userId": 1, "name": "kerem"}]
    assert api.delete("/auth/me/blocks/1", headers=bearer(ozgun["token"])).status_code == 200
    assert kerem_as_seen_by(ozgun_b)["blocked"] is False
    assert [p["id"] for p in photos_seen_by(ozgun_b)] == [photo]


def test_leaving_a_league(api, mail, board):
    owner, ozgun, _, _, ids = league(api, mail, board)
    assert api.delete(board.url("/membership"), headers=bearer(owner["token"])).status_code == 409
    assert api.delete(board.url("/membership"), headers=bearer(ozgun["token"])).json() == {"left": True}
    assert api.get("/auth/boards", headers=bearer(ozgun["token"])).json() == []
    # their player and matches stay
    assert "ozgun" in [p["name"] for p in api.get(board.url("/players"), headers=board.member).json()]


def test_removed_and_kept_out(api, mail, board):
    owner, ids = owned_board(api, mail, board)
    code = api.post(board.url("/invites"), json={}, headers=bearer(owner["token"])).json()["code"]
    seyyid = sign_in(api, mail, "seyyid@example.com")
    api.post(f"/invites/{code}/accept", json={}, headers=bearer(seyyid["token"]))
    seyyid_id = seyyid["user"]["id"]

    removed = api.delete(board.url(f"/members/{seyyid_id}?block=true"), headers=bearer(owner["token"]))
    assert removed.json() == {"removed": True, "blocked": True}
    assert api.post(f"/invites/{code}/accept", json={}, headers=bearer(seyyid["token"])).status_code == 403
    members = api.get(board.url("/members"), headers=bearer(owner["token"])).json()
    assert [b["userId"] for b in members["blocked"]] == [seyyid_id]

    assert api.delete(board.url(f"/blocked/{seyyid_id}"), headers=bearer(owner["token"])).status_code == 200
    assert api.post(f"/invites/{code}/accept", json={}, headers=bearer(seyyid["token"])).status_code == 200


def test_a_suspended_account_is_out(api, mail, board):
    owner, ozgun, _, ozgun_b, ids = league(api, mail, board)
    api.put("/auth/me/photo", content=picture(), headers=bearer(ozgun["token"]))
    ozgun_id = ozgun["user"]["id"]
    assert api.put(f"/admin/users/{ozgun_id}/suspension").status_code == 403
    assert api.put(f"/admin/users/{ozgun_id}/suspension", headers=OPERATOR).status_code == 200

    assert api.get("/auth/me", headers=bearer(ozgun["token"])).status_code == 401
    assert api.get(board.url("/players"), headers=ozgun_b).status_code == 401
    assert api.post("/auth/email", json={"email": "ozgun@example.com"}).status_code == 202
    code = mail[-1]["link"].split("token=")[1]
    assert api.post("/auth/email/verify", json={"token": code}).status_code == 403
    seen = next(p for p in api.get(board.url("/players"), headers=board.member).json() if p["name"] == "ozgun")
    assert seen["photo"] is None

    assert api.delete(f"/admin/users/{ozgun_id}/suspension", headers=OPERATOR).status_code == 200
    again = sign_in(api, mail, "ozgun@example.com")
    assert api.get("/auth/me", headers=bearer(again["token"])).status_code == 200
