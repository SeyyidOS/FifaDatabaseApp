/** Matches a player needs before they get a rank. */
export const RANKED_GAMES = 15;

/** The bar for a rank on this board: 15 matches, or half of the most anyone has played while the board is young. */
export const rankedGames = (mostPlayed: number) => Math.min(RANKED_GAMES, Math.ceil(mostPlayed / 2));

/**
 * Best rating first. Players who have played `need` matches get ranks 1, 2, 3…; the rest are new to the
 * board: they keep their rating and follow the ranked players, with rank 0.
 */
export function rankByRating<T>(
  players: T[],
  rating: (p: T) => number,
  played: (p: T) => number,
  need: number,
): { player: T; rank: number }[] {
  const byRating = [...players].sort((a, b) => rating(b) - rating(a));
  const ranked = byRating.filter((p) => played(p) >= need).map((player, i) => ({ player, rank: i + 1 }));
  const fresh = byRating.filter((p) => played(p) < need).map((player) => ({ player, rank: 0 }));
  return [...ranked, ...fresh];
}
