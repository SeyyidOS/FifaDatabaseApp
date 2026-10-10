import pytest

from elo import compute_ratings, expected_score, margin_multiplier

PLAYERS = [1, 2]


def match(a, b, score_a, score_b, club_a_elo=500, club_b_elo=500, club_weight=0.5):
    return dict(
        team_a=a,
        team_b=b,
        club_a_elo=club_a_elo,
        club_b_elo=club_b_elo,
        club_weight=club_weight,
        score_a=score_a,
        score_b=score_b,
    )


def test_expected_score_is_symmetric():
    assert expected_score(1200, 1000) + expected_score(1000, 1200) == pytest.approx(1)
    assert expected_score(1000, 1000) == 0.5


def test_win_between_equals_matches_hand_calculation():
    factor = 1 + 2 * (3 / 15) ** 1.5  # margin 3, no upset bonus
    gain = 24 * 0.5 * factor
    expected = {1: round(1000 + gain), 2: round(1000 - gain)}
    assert compute_ratings(PLAYERS, [match([1], [2], 3, 0)], 24) == expected


def test_draw_between_equals_changes_nothing():
    assert compute_ratings(PLAYERS, [match([1], [2], 2, 2)], 24) == {1: 1000, 2: 1000}


def test_beating_a_stronger_club_is_worth_more():
    plain = compute_ratings(PLAYERS, [match([1], [2], 2, 1)], 24)
    upset = compute_ratings(PLAYERS, [match([1], [2], 2, 1, club_b_elo=1100)], 24)
    assert upset[1] > plain[1]


def test_only_the_gap_between_club_ratings_matters():
    shifted = compute_ratings(PLAYERS, [match([1], [2], 4, 1, 900, 700)], 24)
    assert shifted == compute_ratings(PLAYERS, [match([1], [2], 4, 1, 700, 500)], 24)


def test_the_club_weight_scales_the_club_gap():
    # 200 club Elo apart at ×0.5 counts like 100 apart at ×1, and nothing at ×0
    half = compute_ratings(PLAYERS, [match([1], [2], 2, 1, 700, 500)], 24)
    assert half == compute_ratings(PLAYERS, [match([1], [2], 2, 1, 600, 500, club_weight=1)], 24)
    assert compute_ratings(PLAYERS, [match([1], [2], 2, 1, 700, 500, club_weight=0)], 24) == compute_ratings(
        PLAYERS, [match([1], [2], 2, 1)], 24
    )


def test_sides_without_known_players_are_skipped():
    assert compute_ratings(PLAYERS, [match([99], [2], 5, 0), match([], [1], 1, 0)], 24) == {1: 1000, 2: 1000}


def test_upset_multiplier_rewards_the_underdog():
    assert margin_multiplier(900, 1100, 5) > margin_multiplier(1100, 900, 5)
    assert margin_multiplier(1000, 1000, 15) == pytest.approx(3.0)
