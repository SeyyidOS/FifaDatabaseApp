import { describe, expect, it } from "vitest";
import { kitFor } from "./kits";

describe("kitFor", () => {
  it("knows a club's kit by its name, alias or spelling without accents", () => {
    expect(kitFor("Galatasaray")).toMatchObject({ abbr: "GS", pattern: "halves" });
    expect(kitFor("Juventus")).toEqual(kitFor("Juventus FC"));
    expect(kitFor("Fenerbahçe")).toEqual(kitFor("fenerbahce"));
    expect(kitFor("Arsenal").trim).toBe("#ffffff");
  });

  it("gives the trim the accent colour unless the table says otherwise", () => {
    expect(kitFor("Liverpool")).toMatchObject({ accent: "#ffffff", trim: "#ffffff" });
  });

  it("makes up a lasting kit for a club it doesn't know", () => {
    const kit = kitFor("Kasımpaşa");
    expect(kit).toEqual(kitFor("Kasımpaşa"));
    expect(kit.abbr).toBe("KAS");
    expect(kit.body).not.toBe(kit.accent);
    expect(kitFor("Sheffield Wednesday FC").abbr).toBe("SW");
  });
});
