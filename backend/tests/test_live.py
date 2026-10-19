"""Matches being played now: started on one device, finished on another."""

from datetime import UTC, datetime, timedelta

from conftest import Board

FIRST = {"clubA": "Brentford", "clubB": "Bayer Leverkusen", "teamA": ["deniz", "ece"], "teamB": ["bora", "cem"]}
SECOND = {"clubA": "Arsenal", "clubB": "Chelsea", "teamA": ["ayla", "ferit"], "teamB": ["gul", "hakan"]}


def players(board):
    board.add_players("deniz", "ece", "bora", "cem", "ayla", "ferit", "gul", "hakan")


def live(board):
    return board.api.get(board.url("/live"), headers=board.member).json()


def test_a_match_started_shows_everywhere_until_its_result_is_in(board):
    players(board)
    started = board.api.post(board.url("/live"), json=FIRST, headers=board.member)
    assert started.status_code == 201, started.text
    first = started.json()
    assert (first["teamA"], first["teamB"], first["clubA"], first["clubB"]) == (
        ["deniz", "ece"],
        ["bora", "cem"],
        "Brentford",
        "Bayer Leverkusen",
    )
    # several at once: one per console
    second = board.api.post(board.url("/live"), json=SECOND, headers=board.member).json()
    assert [m["id"] for m in live(board)] == [first["id"], second["id"]]
    # starting saves no match
    assert board.api.get(board.url("/matches"), headers=board.member).json() == []

    # the result, entered with the sides the other way round, ends that one only
    result = {**FIRST, "teamA": ["cem", "bora"], "teamB": ["ece", "deniz"], "scoreA": 1, "scoreB": 2}
    assert board.api.post(board.url("/matches"), json=result, headers=board.member).status_code == 201
    assert [m["id"] for m in live(board)] == [second["id"]]


def test_a_player_cant_be_in_two_matches_unless_asked(board):
    players(board)
    first = board.api.post(board.url("/live"), json=FIRST, headers=board.member).json()
    clash = {**SECOND, "teamA": ["ayla", "cem"]}
    refused = board.api.post(board.url("/live"), json=clash, headers=board.member)
    assert refused.status_code == 409 and "cem" in refused.json()["detail"]
    assert board.api.post(board.url("/live"), json={**clash, "force": True}, headers=board.member).status_code == 201

    # changing teams or clubs replaces it, without clashing with itself
    changed = {**FIRST, "clubA": "Arsenal", "replaces": first["id"]}
    board.api.delete(board.url(f"/live/{live(board)[1]['id']}"), headers=board.member)
    replaced = board.api.post(board.url("/live"), json=changed, headers=board.member)
    assert replaced.status_code == 201, replaced.text
    assert [(m["id"], m["clubA"]) for m in live(board)] == [(replaced.json()["id"], "Arsenal")]


def test_started_by_mistake_is_cancelled(board):
    players(board)
    first = board.api.post(board.url("/live"), json=FIRST, headers=board.member).json()
    other = Board(board.api, "Other Crew")
    assert board.api.delete(other.url(f"/live/{first['id']}"), headers=other.member).status_code == 404
    assert board.api.delete(board.url(f"/live/{first['id']}"), headers=board.member).status_code == 200
    assert live(board) == []
    assert board.api.delete(board.url(f"/live/{first['id']}"), headers=board.member).status_code == 404
    assert board.api.get(board.url("/matches"), headers=board.member).json() == []


def test_a_forgotten_match_goes_after_three_hours(board):
    players(board)
    board.api.post(board.url("/live"), json=FIRST, headers=board.member)
    board.api.app.state.db.execute("UPDATE live_matches SET started_at = started_at - INTERVAL '3 hours 1 minute'")
    assert live(board) == []
    # and doesn't block its players any more
    assert board.api.post(board.url("/live"), json=FIRST, headers=board.member).status_code == 201


def test_one_brought_back_keeps_its_start(board):
    players(board)
    ten_ago = datetime.now(UTC).replace(tzinfo=None, microsecond=0) - timedelta(minutes=10)
    back = board.api.post(board.url("/live"), json={**FIRST, "startedAt": ten_ago.isoformat()}, headers=board.member)
    assert datetime.fromisoformat(back.json()["startedAt"]) == ten_ago
    # but not from the future or from long ago
    board.api.delete(board.url(f"/live/{back.json()['id']}"), headers=board.member)
    later = (ten_ago + timedelta(hours=2)).isoformat()
    future = board.api.post(board.url("/live"), json={**FIRST, "startedAt": later}, headers=board.member).json()
    assert datetime.fromisoformat(future["startedAt"]) < ten_ago + timedelta(minutes=11)


def test_bad_line_ups_are_refused(board):
    players(board)
    unknown = board.api.post(board.url("/live"), json={**FIRST, "teamA": ["nobody"]}, headers=board.member)
    assert unknown.status_code == 422
    twice = board.api.post(board.url("/live"), json={**FIRST, "teamB": ["deniz"]}, headers=board.member)
    assert twice.status_code == 422
    assert board.api.post(board.url("/live"), json=FIRST).status_code == 401
