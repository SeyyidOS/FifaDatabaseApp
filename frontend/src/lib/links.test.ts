import { describe, expect, it } from "vitest";
import { linkTarget } from "./links";

describe("linkTarget", () => {
  it("opens an invite from its link or its code", () => {
    expect(linkTarget("https://matchnight.example.com/#/join/ZSY6EiGfgcDi")).toBe("/join/ZSY6EiGfgcDi");
    expect(linkTarget("  Join Friday on Matchnight https://x.test/#/join/a_b-C1234567 ")).toBe("/join/a_b-C1234567");
    expect(linkTarget("ZSY6EiGfgcDi")).toBe("/join/ZSY6EiGfgcDi");
  });

  it("opens a board from its own link", () => {
    expect(linkTarget("https://x.test/#/b/Friday-Night/leaderboard")).toBe("/b/friday-night");
  });

  it("turns down anything else", () => {
    expect(linkTarget("")).toBeNull();
    expect(linkTarget("hello there")).toBeNull();
    expect(linkTarget("short")).toBeNull();
  });
});
