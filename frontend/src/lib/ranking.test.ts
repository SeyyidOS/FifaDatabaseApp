import { describe, expect, it } from "vitest";
import { rankByRating, rankedGames } from "./ranking";

describe("ranked games", () => {
  it("is 15 on a settled board and half the most played on a young one", () => {
    expect([92, 30, 29, 10, 1, 0].map(rankedGames)).toEqual([15, 15, 15, 5, 1, 0]);
  });
});

describe("rank by rating", () => {
  // the main board on 10 October 2026: Elo and matches played
  const board: [string, number, number][] = [
    ["kerem", 1751, 82], ["bedirhan", 1308, 73], ["ihsan", 973, 11], ["seyyid", 968, 92], ["cagatay", 961, 53],
    ["arda", 916, 9], ["ozgun", 911, 76], ["samed", 908, 7], ["alperen", 897, 11], ["sevban", 831, 10], ["kemal", 576, 92],
  ];
  const ranks = (need: number) =>
    rankByRating(board, (p) => p[1], (p) => p[2], need).map(({ player, rank }) => `${player[0]}:${rank}`);

  it("ranks those with enough matches and lists the new players after them, by rating", () => {
    expect(ranks(15)).toEqual([
      "kerem:1", "bedirhan:2", "seyyid:3", "cagatay:4", "ozgun:5", "kemal:6",
      "ihsan:0", "arda:0", "samed:0", "alperen:0", "sevban:0",
    ]);
  });

  it("ranks everyone when nobody needs more matches", () => {
    expect(ranks(0).slice(0, 4)).toEqual(["kerem:1", "bedirhan:2", "ihsan:3", "seyyid:4"]);
  });
});
