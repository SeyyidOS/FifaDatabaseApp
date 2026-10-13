import { describe, expect, it } from "vitest";
import { betterSide, METRICS, metricValue, playerStatLines, STAT_DEFS } from "./matchStats";
import { parseMatches } from "./stats";
import type { Match, MatchStats } from "./types";

const match = (id: number, teamA: string[], teamB: string[], scoreA: number, scoreB: number, stats: MatchStats | null): Match => ({
  id,
  time: `2026-10-10 2${id}:00:00`,
  season_id: 1,
  club_a: "A FC",
  club_b: "B FC",
  club_a_elo: 500,
  club_b_elo: 500,
  club_weight: 0.5,
  team_a: teamA,
  team_b: teamB,
  score_a: scoreA,
  score_b: scoreB,
  photos: [],
  stats,
});

const parsed = parseMatches([
  match(1, ["ali", "veli"], ["can", "efe"], 3, 1, {
    A: { xg: 1.5, possession: 60, yellowCards: 1, redCards: 1 },
    B: { xg: 2.0, possession: 40 },
    source: "ocr",
    photoId: 1,
  }),
  // no xG for side B: counts for possession only
  match(2, ["ali"], ["can"], 0, 2, { A: { xg: 0.5, possession: 50 }, B: { possession: 50 }, source: "manual", photoId: null }),
  match(3, ["ali", "veli"], ["can", "efe"], 1, 1, null),
]);

describe("match stats", () => {
  it("credits a side's numbers to each of its players", () => {
    const lines = playerStatLines(parsed);
    const ali = lines.get("ali")!;
    expect([ali.matches, ali.goalsFor, ali.goalsAgainst]).toEqual([2, 3, 3]);
    expect(lines.get("veli")!.matches).toBe(1);
    expect(lines.has("nobody")).toBe(false);

    expect(metricValue(ali, "possession")).toBe(55);
    expect(metricValue(ali, "xg")).toBe(1);
    // xG against is known for one match only
    expect(metricValue(ali, "xga")).toBe(2);
    // 3 goals from 2.0 xG over two matches
    expect(metricValue(ali, "finishing")).toBeCloseTo(0.5);
    // 2.0 xG against, 1 goal let in, in the one match where it is known
    expect(metricValue(ali, "keeping")).toBeCloseTo(1);
    // a yellow and a red (two) in the one match with cards
    expect(metricValue(ali, "cards")).toBe(3);
    expect(metricValue(lines.get("can")!, "cards")).toBeNull();
  });

  it("knows which side did better", () => {
    const def = (key: string) => STAT_DEFS.find((d) => d.key === key)!;
    expect(betterSide(def("shots"), 8, 6)).toBe("A");
    expect(betterSide(def("fouls"), 3, 1)).toBe("B");
    expect(betterSide(def("saves"), 4, 1)).toBeNull();
    expect(betterSide(def("shots"), 6, 6)).toBeNull();
    expect(betterSide(def("shots"), undefined, 6)).toBeNull();
    expect(METRICS.every((m) => m.better === "high" || m.better === "low")).toBe(true);
  });
});
