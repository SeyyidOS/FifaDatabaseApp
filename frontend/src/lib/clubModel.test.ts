import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import golden from "./__fixtures__/fc27-model.golden.json";
import { DEFAULT_MODEL, hungarian, rateClubs, sanitizeModel, type CardSet } from "./clubModel";

const cards: CardSet = JSON.parse(readFileSync(new URL("../../public/games/fc27/cards.json", import.meta.url), "utf8"));
const reference = golden.reference as Record<string, number>;
const byName = (club: { name: string }) => reference[club.name] ?? null;

describe("club model", () => {
  it("uses the settings the study settled on by default", () => {
    expect(sanitizeModel(golden.model)).toEqual(DEFAULT_MODEL);
    expect(sanitizeModel(undefined)).toEqual(DEFAULT_MODEL);
  });

  it("reproduces the original page for all 55 clubs", () => {
    const result = rateClubs(cards, sanitizeModel(golden.model), byName);
    const expected = golden.clubs as Record<string, { rank: number; elo: number; xiScore: number; benchScore: number; ovr: number }>;
    expect(result.rows).toHaveLength(55);
    for (const r of result.rows) {
      const want = expected[r.club.name];
      expect({ club: r.club.name, rank: r.rank, elo: Math.round(r.elo) }).toEqual({ club: r.club.name, rank: want.rank, elo: want.elo });
      expect(r.xiScore!.toFixed(2)).toBe(want.xiScore.toFixed(2));
      expect(r.benchScore!.toFixed(2)).toBe(want.benchScore.toFixed(2));
      expect(r.ovr!.toFixed(1)).toBe(want.ovr.toFixed(1));
    }
    expect(result.agree!.rho).toBeGreaterThan(0.8);
  });

  it("falls back to the fixed scale without a reference season", () => {
    const model = sanitizeModel(golden.model, false);
    expect(model.scale.mode).toBe("fixed");
    const result = rateClubs(cards, model, () => null);
    const top = result.rows[0];
    expect(top.elo).toBeCloseTo(1500 + 50 * (top.score! - 80) - 50 * top.missing, 6);
  });

  it("solves small assignments optimally", () => {
    expect(hungarian([[4, 1, 3], [2, 0, 5], [3, 2, 2]])).toEqual([1, 0, 2]);
  });

  it("bounds edited settings", () => {
    const m = sanitizeModel({ bench: { W: 9 }, posW: { GK: -1 }, statW: { PAC: 0.8, SHO: 0.8 }, altMode: "nope", benchW: 7 });
    expect(m.bench.W).toBe(DEFAULT_MODEL.bench.W);
    expect(m.posW.GK).toBe(DEFAULT_MODEL.posW.GK);
    expect(m.statW.PAC + m.statW.SHO).toBeCloseTo(1, 2);
    expect(m.altMode).toBe("free");
    expect(m.benchW).toBe(DEFAULT_MODEL.benchW);
  });
});
