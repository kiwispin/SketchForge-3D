import { describe, expect, it } from "vitest";
import { frontAlignedHomePosition, viewFaceDirection, viewFaceUp } from "@/lib/viewCube";

describe("view cube orientation", () => {
  it("starts Home straight onto the front while retaining workplane elevation", () => {
    const home = frontAlignedHomePosition();
    expect(home.x).toBeCloseTo(0);
    expect(home.y).toBeGreaterThan(0);
    expect(home.z).toBeGreaterThan(0);
    expect(Math.atan2(home.x, home.z)).toBeCloseTo(0);
  });

  it("maps all six faces to unique cardinal directions", () => {
    const directions = (["top", "bottom", "front", "back", "right", "left"] as const).map((face) => viewFaceDirection(face).toArray().join(","));
    expect(new Set(directions).size).toBe(6);
  });

  it("uses a non-parallel up vector for top and bottom views", () => {
    expect(viewFaceDirection("top").dot(viewFaceUp("top"))).toBe(0);
    expect(viewFaceDirection("bottom").dot(viewFaceUp("bottom"))).toBe(0);
  });
});
