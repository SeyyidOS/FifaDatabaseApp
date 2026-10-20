import { describe, expect, it } from "vitest";
import { editionOf, FEATURES, featureOn, type Feature } from "./edition";

describe("editions", () => {
  it("is store if the build or the server says so, classic otherwise", () => {
    expect(editionOf(undefined, undefined)).toBe("classic");
    expect(editionOf(undefined, "")).toBe("classic");
    expect(editionOf(undefined, "classic")).toBe("classic");
    expect(editionOf(undefined, "nonsense")).toBe("classic");
    expect(editionOf(undefined, " Store ")).toBe("store");
    expect(editionOf("store", undefined)).toBe("store");
    // a store build stays store whatever the server says
    expect(editionOf("store", "classic")).toBe("store");
    // a device's preview can only move a classic site towards store
    expect(editionOf("classic", "store")).toBe("store");
    expect(editionOf("classic", null)).toBe("classic");
  });

  it("keeps everything that isn't ours to publish out of the store edition", () => {
    const licensed: Feature[] = ["realCrests", "cardRatings", "squads", "cardImport", "gameNames"];
    for (const f of licensed) {
      expect(featureOn(f, "classic"), f).toBe(true);
      expect(featureOn(f, "store"), f).toBe(false);
    }
    expect(featureOn("independenceNote", "store")).toBe(true);
    expect(featureOn("independenceNote", "classic")).toBe(false);
    // every switch is named above, so a new one gets a deliberate place here
    expect(Object.keys(FEATURES).sort()).toEqual([...licensed, "independenceNote"].sort());
  });
});
