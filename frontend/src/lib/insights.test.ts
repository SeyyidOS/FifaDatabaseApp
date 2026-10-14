import { describe, expect, it } from "vitest";
import type { EloPoint } from "./elo";
import { nameLang } from "./format";
import { nightlyElo, playerNights, scoreOfTheNight } from "./insights";
import type { Matchday, ParsedMatch } from "./stats";

const match = (id: number, scoreA: number, scoreB: number): ParsedMatch => ({
  id,
  date: new Date("2026-10-10T18:00:00Z"),
  matchday: "2026-10-10",
  clubA: "A FC",
  clubB: "B FC",
  clubAElo: 500,
  clubBElo: 500,
  teamA: ["ayla"],
  teamB: ["bora"],
  scoreA,
  scoreB,
  result: scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : "D",
  photos: [],
  stats: null,
});
const night = (...matches: ParsedMatch[]): Matchday => ({ key: "2026-10-10", matches, goals: 0 });

describe("score of the night", () => {
  it("is the biggest win, then the most goals", () => {
    expect(scoreOfTheNight(night(match(1, 3, 8), match(2, 8, 2), match(3, 6, 1)))?.id).toBe(2);
    expect(scoreOfTheNight(night(match(1, 6, 1), match(2, 2, 7)))?.id).toBe(2);
  });

  it("keeps the later match on a tie and copes with draws only and empty nights", () => {
    // newest first, like Analytics.matchdays
    expect(scoreOfTheNight(night(match(5, 2, 0), match(4, 0, 2)))?.id).toBe(5);
    expect(scoreOfTheNight(night(match(1, 1, 1), match(2, 4, 4)))?.id).toBe(2);
    expect(scoreOfTheNight(night())).toBeUndefined();
  });
});

describe("nightly Elo", () => {
  const point = (iso: string, elo: number): EloPoint => ({ matchId: 0, time: new Date(iso), elo });

  it("keeps the last rating of each night, a match after midnight counting for the evening before", () => {
    const history = [
      point("2026-10-02T18:00:00Z", 1012),
      point("2026-10-02T23:30:00Z", 1030), // 02:30 in Istanbul: still the 2 October night
      point("2026-10-10T17:00:00Z", 1004),
      point("2026-10-10T19:00:00Z", 1021),
    ];
    expect(nightlyElo(history)).toEqual([1000, 1030, 1021]);
  });

  it("is just the start for a player with no matches", () => {
    expect(nightlyElo([])).toEqual([1000]);
  });
});

describe("name casing", () => {
  it("upper-cases names the way they were typed", () => {
    expect(["Seyyid", "Friday Night League", "Ozgun"].map(nameLang)).toEqual(["en", "en", "en"]);
    expect(["Çağatay", "İlker", "Cuma Gecesi Ligi Ş"].map(nameLang)).toEqual(["tr", "tr", "tr"]);
  });
});

describe("player nights", () => {
  const at = (id: number, iso: string, a: number, b: number, teamA = ["ayla"]): ParsedMatch => ({
    ...match(id, a, b),
    date: new Date(iso),
    teamA,
    teamB: teamA[0] === "ayla" ? ["bora"] : ["ayla"],
  });
  const matches = [
    at(1, "2026-10-02T18:00:00Z", 3, 1),
    at(2, "2026-10-02T23:30:00Z", 2, 2),
    at(3, "2026-10-10T17:00:00Z", 0, 1),
    at(4, "2026-10-10T18:00:00Z", 4, 0, ["bora"]), // ayla on side B: a loss
  ];
  const history: EloPoint[] = [
    { matchId: 1, time: matches[0].date, elo: 1012.4 },
    { matchId: 2, time: matches[1].date, elo: 1010.9 },
    { matchId: 3, time: matches[2].date, elo: 996.2 },
    { matchId: 4, time: matches[3].date, elo: 983.6 },
  ];

  it("sums each night's rating change and results", () => {
    expect(playerNights(history, matches, "ayla")).toEqual([
      { key: "2026-10-02", elo: 1011, delta: 11, wins: 1, draws: 1, losses: 0 },
      { key: "2026-10-10", elo: 984, delta: -27, wins: 0, draws: 0, losses: 2 },
    ]);
  });

  it("has no nights for a player without matches", () => {
    expect(playerNights([], matches, "ayla")).toEqual([]);
  });
});
