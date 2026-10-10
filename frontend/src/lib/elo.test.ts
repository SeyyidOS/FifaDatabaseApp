import { describe, expect, it } from "vitest";
import { expectedScore, previewMatch, runElo } from "./elo";
import type { Club, Match, Player } from "./types";

const players: Player[] = ["kerem", "seyyid", "ali", "veli"].map((name, i) => ({ id: i + 1, name, archived: false }));
const club = (id: number, name: string, elo: number): Club => ({ id, name, elo, eaId: null, modelElo: null, adjust: 0 });
const clubs = [club(1, "Real Madrid", 1300), club(2, "Arsenal", 1000)];
const match = (id: number, clubWeight: number): Match => ({
  id,
  time: `2026-10-0${id} 20:00:00`,
  season_id: 1,
  club_a: "Arsenal",
  club_b: "Real Madrid",
  club_a_elo: 1000,
  club_b_elo: 1300,
  club_weight: clubWeight,
  team_a: ["kerem", "seyyid"],
  team_b: ["ali", "veli"],
  score_a: 3,
  score_b: 1,
});
const sides = { teamA: ["kerem", "seyyid"], teamB: ["ali", "veli"], clubA: "Real Madrid", clubB: "Arsenal" };

describe("club weight", () => {
  it("replays each match with the weight it was entered with, whatever the board's weight now", () => {
    const now = (w: number) => runElo(players, clubs, [match(1, 0.5)], 24, w).ratings;
    expect(now(1.5)).toEqual(now(0.5));
    // the same result at a higher weight was a bigger upset, so it moves ratings further
    const at = (w: number) => runElo(players, clubs, [match(1, w)], 24, 0.5).ratings.get(1)!;
    expect(at(1)).toBeGreaterThan(at(0.5));
  });

  it("previews a new match at the board's weight", () => {
    const engine = runElo(players, clubs, [match(1, 0.5)], 24, 1.5);
    const squads = previewMatch(engine, { teamA: sides.teamA, teamB: sides.teamB });
    const p = previewMatch(engine, sides);
    expect(p.expectedA).toBeCloseTo(expectedScore(squads.strengthA + 1.5 * 1300, squads.strengthB + 1.5 * 1000), 10);
  });

  it("leaves the clubs out of a preview until both are picked", () => {
    const engine = runElo(players, clubs, [match(1, 0.5)], 24, 2);
    const squads = previewMatch(engine, { teamA: sides.teamA, teamB: sides.teamB }).expectedA;
    expect(previewMatch(engine, { ...sides, clubB: undefined }).expectedA).toBeCloseTo(squads, 10);
  });
});
