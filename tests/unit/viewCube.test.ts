import { describe, expect, it } from "vitest";
import { frontAlignedHomePosition, viewFaceDirection, viewFaceOrbitPose } from "@/lib/viewCube";

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

  it("keeps every snapped view in the same world-up orbit frame", () => {
    for (const face of ["top", "bottom", "front", "back", "right", "left"] as const) {
      expect(viewFaceOrbitPose(face).up.toArray()).toEqual([0, 1, 0]);
    }
  });

  it("keeps top and bottom visually square while avoiding the exact orbit pole", () => {
    for (const face of ["top", "bottom"] as const) {
      const { direction } = viewFaceOrbitPose(face);
      expect(direction.length()).toBeCloseTo(1, 12);
      expect(direction.x).toBe(0);
      expect(direction.z).toBeGreaterThan(0);
      expect(Math.abs(direction.y)).toBeGreaterThan(0.9999999);
      expect(Math.abs(direction.y)).toBeLessThan(1);
    }
  });
});
