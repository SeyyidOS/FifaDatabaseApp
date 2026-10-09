import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, generateFixture, pairCounts, streakAdvice, type Fixture, type FixtureRules } from "./fixture";

/** Deterministic random numbers so failures can be reproduced. */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const people = (n: number) => ["kerem", "seyyid", "bedirhan", "kemal", "ozgun", "cagatay", "ihsan", "samed", "alperen", "sevban"].slice(0, n);
const elo = (name: string) => 800 + name.length * 50;

/** Checks the rules directly, independently of the generator's own bookkeeping. */
function brokenRules(f: Fixture, players: string[], rules: FixtureRules) {
  let broken = 0;
  const streak = new Map(players.map((p) => [p, 0]));
  const lastPartner = new Map<string, string>();
  const partnerStreak = new Map<string, number>();
  const together = new Map<string, number>();
  for (const m of f.matches) {
    const inMatch = new Set([...m.a, ...m.b]);
    for (const p of players) {
      streak.set(p, inMatch.has(p) ? streak.get(p)! + 1 : 0);
      if (streak.get(p)! > rules.maxStreak) broken++;
    }
    for (const [p, q] of [m.a, m.b]) {
      const key = [p, q].sort().join("|");
      together.set(key, (together.get(key) ?? 0) + 1);
      if (rules.partnerCap && together.get(key)! > rules.partnerCap) broken++;
      for (const [x, y] of [[p, q], [q, p]]) {
        partnerStreak.set(x, lastPartner.get(x) === y ? partnerStreak.get(x)! + 1 : 1);
        lastPartner.set(x, y);
      }
      if (partnerStreak.get(p)! > rules.maxPartner) broken++;
    }
  }
  return broken;
}

describe("night fixture", () => {
  it.each([6, 7, 8, 9, 10])("plans %i players without breaking a rule", (n) => {
    const players = people(n);
    const f = generateFixture(players, DEFAULT_RULES, elo, seeded(n))!;
    expect(f).not.toBeNull();
    expect(f.violations).toBe(0);
    expect(brokenRules(f, players, DEFAULT_RULES)).toBe(0);
    const played = new Map(players.map((p) => [p, 0]));
    for (const m of f.matches) {
      expect(new Set([...m.a, ...m.b]).size).toBe(4);
      [...m.a, ...m.b].forEach((p) => played.set(p, played.get(p)! + 1));
    }
    expect(Math.min(...played.values())).toBeGreaterThanOrEqual(DEFAULT_RULES.minPer);
    expect(f.spread).toBe(Math.max(...played.values()) - Math.min(...played.values()));
  });

  it("respects a cap on how often a pair plays together", () => {
    const players = people(8);
    const rules = { ...DEFAULT_RULES, minPer: 4, partnerCap: 1 };
    const f = generateFixture(players, rules, elo, seeded(42))!;
    expect(brokenRules(f, players, rules)).toBe(0);
    expect(Math.max(...pairCounts(f.matches).together.values())).toBe(1);
  });

  it("still plans when the rules can't all hold, and says how many it breaks", () => {
    const players = people(5); // one rests per match: "at most 2 in a row" is impossible
    const f = generateFixture(players, DEFAULT_RULES, elo, seeded(5))!;
    expect(f.violations).toBeGreaterThan(0);
    expect(f.violations).toBe(brokenRules(f, players, DEFAULT_RULES));
  });

  it("evens out Elo when asked", () => {
    const players = people(8);
    const strength = (name: string) => (["kerem", "seyyid"].includes(name) ? 1600 : 900);
    const plain = generateFixture(players, DEFAULT_RULES, strength, seeded(1))!;
    const balanced = generateFixture(players, { ...DEFAULT_RULES, balance: true }, strength, seeded(1))!;
    expect(balanced.eloGap / balanced.matches.length).toBeLessThanOrEqual(plain.eloGap / plain.matches.length);
  });

  it("needs four players", () => {
    expect(generateFixture(people(3), DEFAULT_RULES, elo, seeded(3))).toBeNull();
  });

  it("explains when the streak rule can't work", () => {
    expect(streakAdvice(4, 2)).toEqual({ kind: "everyone" });
    expect(streakAdvice(5, 2)).toEqual({ kind: "impossible", need: 4, fair: 5 });
    expect(streakAdvice(6, 2)).toEqual({ kind: "same-rest", next: 3 });
    expect(streakAdvice(8, 2)).toBeNull();
  });
});
