import pytest

from elo import compute_ratings, expected_score, margin_multiplier

PLAYERS = [1, 2]
CLUBS = [{"name": "Even", "elo": 500}, {"name": "Giant", "elo": 1100}]


def match(a, b, score_a, score_b, club_a="Even", club_b="Even"):
    return {"team_a": a, "team_b": b, "club_a": club_a, "club_b": club_b, "score_a": score_a, "score_b": score_b}


def test_expected_score_is_symmetric():
    assert expected_score(1200, 1000) + expected_score(1000, 1200) == pytest.approx(1)
    assert expected_score(1000, 1000) == 0.5


def test_win_between_equals_matches_hand_calculation():
    factor = 1 + 2 * (3 / 15) ** 1.5  # margin 3, no upset bonus
    gain = 24 * 0.5 * factor
    expected = {1: round(1000 + gain), 2: round(1000 - gain)}
    assert compute_ratings(PLAYERS, CLUBS, [match([1], [2], 3, 0)], 24) == expected


def test_draw_between_equals_changes_nothing():
    assert compute_ratings(PLAYERS, CLUBS, [match([1], [2], 2, 2)], 24) == {1: 1000, 2: 1000}


def test_beating_a_stronger_club_is_worth_more():
    plain = compute_ratings(PLAYERS, CLUBS, [match([1], [2], 2, 1)], 24)
    upset = compute_ratings(PLAYERS, CLUBS, [match([1], [2], 2, 1, club_b="Giant")], 24)
    assert upset[1] > plain[1]


def test_unknown_club_counts_as_default_rating():
    custom = compute_ratings(PLAYERS, CLUBS, [match([1], [2], 4, 1, club_a="Sunday League FC")], 24)
    assert custom == compute_ratings(PLAYERS, CLUBS, [match([1], [2], 4, 1)], 24)


def test_sides_without_known_players_are_skipped():
    assert compute_ratings(PLAYERS, CLUBS, [match([99], [2], 5, 0), match([], [1], 1, 0)], 24) == {1: 1000, 2: 1000}


def test_upset_multiplier_rewards_the_underdog():
    assert margin_multiplier(900, 1100, 5) > margin_multiplier(1100, 900, 5)
    assert margin_multiplier(1000, 1000, 15) == pytest.approx(3.0)
