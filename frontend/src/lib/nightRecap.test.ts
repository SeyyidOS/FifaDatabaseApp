import { describe, expect, it } from "vitest";
import { buildAppearances } from "./analysis";
import { runElo } from "./elo";
import { nightRecap } from "./nightRecap";
import { groupMatchdays, parseMatches } from "./stats";
import type { Match, Player } from "./types";

// A real night (10 October 2026, times in UTC), with the players renamed.
const NIGHT: [string, string, number, string, string, string, string, number][] = [
  ["17:05", "Real Madrid", 1308, "ayla+bora", "2-3", "cem+deniz", "Brentford", 494],
  ["17:34", "Leeds United", 396, "ece+bora", "1-2", "ferit+gul", "AC Milan", 734],
  ["18:01", "Panathinaikos", 119, "cem+ayla", "0-5", "ece+ferit", "Arsenal", 976],
  ["18:27", "Newcastle United", 612, "deniz+gul", "1-7", "ferit+cem", "PAOK", -27],
  ["18:52", "Liverpool", 1039, "bora+gul", "1-6", "ayla+deniz", "Real Betis", 508],
  ["19:14", "PSV", 345, "ece+ayla", "4-3", "deniz+bora", "Başakşehir", -172],
  ["19:41", "Club Brugge", 26, "ferit+bora", "4-4", "gul+ece", "Como", 511],
  ["20:09", "PAOK", -27, "cem+ece", "8-2", "ayla+gul", "Manchester City", 1023],
  ["20:36", "AC Milan", 734, "deniz+ferit", "2-2", "cem+gul", "Borussia Dortmund", 709],
  ["21:05", "Tottenham Hotspur", 693, "ayla+ferit", "3-8", "ece+deniz", "RB Leipzig", 489],
  ["21:28", "Bayern Munich", 1126, "gul+bora", "2-5", "ayla+cem", "West Ham United", 49],
  ["21:53", "Rennes", 312, "bora+cem", "3-3", "ece+ferit", "Barcelona", 1252],
  ["22:19", "Paris Saint-Germain", 1305, "ece+bora", "6-1", "cem+deniz", "Strasbourg", -20],
  ["23:14", "Rennes", 312, "deniz+ayla", "8-3", "ferit+gul", "Liverpool", 1039],
  ["23:40", "PAOK", -27, "ferit+cem", "5-1", "ayla+bora", "Napoli", 719],
  ["00:08", "Barcelona", 1252, "gul+deniz", "5-2", "ece+cem", "Hoffenheim", 335],
];

const names = ["ayla", "bora", "cem", "deniz", "ece", "ferit", "gul"];
const players: Player[] = names.map((name, i) => ({ id: i + 1, name, archived: false }));
const matches: Match[] = NIGHT.map(([time, clubA, eloA, teamA, score, teamB, clubB, eloB], i) => {
  const [a, b] = score.split("-").map(Number);
  return {
    id: i + 1,
    time: `2026-10-${time < "12:00" ? "11" : "10"} ${time}:00`,
    season_id: 1,
    club_a: clubA,
    club_b: clubB,
    club_a_elo: eloA,
    club_b_elo: eloB,
    club_weight: 0.5,
    team_a: teamA.split("+"),
    team_b: teamB.split("+"),
    score_a: a,
    score_b: b,
    photos: i === 7 ? [1, 2] : [],
  };
});

function recap() {
  const parsed = parseMatches(matches);
  const engine = runElo(players, [], matches, 24, 0.5);
  const [day] = groupMatchdays(parsed);
  return nightRecap(day, engine, buildAppearances(parsed, engine));
}

describe("night recap", () => {
  it("counts the night", () => {
    const r = recap();
    expect(r.key).toBe("2026-10-10");
    expect([r.matches.length, r.goals, r.draws, r.photos]).toEqual([16, 112, 3, 2]);
    expect(r.matches[0].id).toBe(1);
    expect(r.players.map((p) => p.played).reduce((a, b) => a + b)).toBe(64);
  });

  it("finds the night's stories", () => {
    const r = recap();
    // PAOK, the weakest club on paper, won all three
    expect(r.club).toMatchObject({ club: "PAOK", played: 3, wins: 3, gf: 20, ga: 4, underdog: true });
    // both 2–0 and +10; fewer goals conceded wins
    expect(r.dreamDuo?.pair).toEqual(["cem", "ferit"]);
    expect(r.nightmareDuo).toMatchObject({ pair: ["bora", "gul"], wins: 0, losses: 2 });
    // two matches had 11 goals: the later one
    expect(r.goalFest?.id).toBe(14);
    expect(r.lastWord).toMatchObject({ winner: "A", match: { id: 16 } });
    expect(r.biggestUpset!.chance).toBeLessThan(0.35);
    expect(r.upsets).toBeGreaterThanOrEqual(5);
  });

  it("hands out the awards", () => {
    const r = recap();
    const award = (key: string) => r.awards.find((a) => a.key === key);
    expect(award("giantSlayer")).toMatchObject({ winner: { name: "cem" }, value: 5 });
    expect(award("unbeaten")).toMatchObject({ winner: { name: "ece" }, value: 7 });
    expect(award("machine")?.winner.name).toBe("ece");
    expect(award("wall")?.winner.name).toBe("ece");
    expect(award("nightOwl")).toMatchObject({ winner: { name: "deniz" }, value: 9 });
    expect(award("diplomat")).toMatchObject({ winner: { name: "ferit" }, value: 3 });
    expect(award("ironMan")).toMatchObject({ winner: { name: "cem" }, value: 10 });
    expect(award("cursed")).toMatchObject({ winner: { name: "gul" }, value: 5, roast: true });
    // gul also let in the most goals, but one roast a night is enough
    expect(award("sieve")).toBeUndefined();
    expect(award("chinUp")).toMatchObject({ winner: { name: "bora", wins: 1 }, roast: true });
    const roasted = r.awards.filter((a) => a.roast).map((a) => a.winner.name);
    expect(new Set(roasted).size).toBe(roasted.length);
    expect(award("king")?.winner.name).toBe(r.players[0].name);
  });
});
