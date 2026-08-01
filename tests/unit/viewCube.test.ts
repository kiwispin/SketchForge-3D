import { describe, expect, it } from "vitest";
import { viewFaceDirection, viewFaceUp } from "@/lib/viewCube";

describe("view cube orientation", () => {
  it("maps all six faces to unique cardinal directions", () => {
    const directions = (["top", "bottom", "front", "back", "right", "left"] as const).map((face) => viewFaceDirection(face).toArray().join(","));
    expect(new Set(directions).size).toBe(6);
  });

  it("uses a non-parallel up vector for top and bottom views", () => {
    expect(viewFaceDirection("top").dot(viewFaceUp("top"))).toBe(0);
    expect(viewFaceDirection("bottom").dot(viewFaceUp("bottom"))).toBe(0);
  });
});
