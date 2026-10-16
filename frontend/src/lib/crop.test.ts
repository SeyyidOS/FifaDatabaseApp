import { describe, expect, it } from "vitest";
import { clampView, initialView, sourceSquare, zoomView } from "./crop";

// a landscape photo in a 300px frame
const W = 1200;
const H = 800;
const F = 300;

describe("cropping a photo to a square", () => {
  it("starts covering the frame, centred", () => {
    const v = initialView(W, H, F);
    expect(v.scale).toBeCloseTo(300 / 800);
    const square = sourceSquare(v, F);
    expect(square.sx).toBeCloseTo(200);
    expect(square.sy).toBeCloseTo(0);
    expect(square.size).toBeCloseTo(800);
  });

  it("never leaves a gap when dragged", () => {
    const v = initialView(W, H, F);
    expect(clampView({ ...v, x: 50, y: -20 }, W, H, F)).toEqual({ x: 0, y: 0, scale: v.scale });
    expect(clampView({ ...v, x: -1000 }, W, H, F).x).toBeCloseTo(F - W * v.scale);
  });

  it("zooms around the middle of the frame", () => {
    const v = zoomView(initialView(W, H, F), 2, W, H, F);
    const square = sourceSquare(v, F);
    expect(square.size).toBeCloseTo(400);
    // still centred on the photo's middle
    expect(square.sx + square.size / 2).toBeCloseTo(W / 2);
    expect(square.sy + square.size / 2).toBeCloseTo(H / 2);
    // and back out: covering again
    expect(sourceSquare(zoomView(v, 1, W, H, F), F).size).toBeCloseTo(800);
  });
});
