import { describe, expect, it } from "vitest";
import { dominantSmartGuideDirection, findDirectionalEdgeDistances, findNearestCenterAlignments, type SmartGuideBounds, type SmartGuideCenter } from "@/lib/smartGuides";

const moving: SmartGuideCenter = { id: "moving", x: 10.2, z: -4.1 };

describe("smart alignment guides", () => {
  it("chooses the dominant world axis for a perspective drag", () => {
    expect(dominantSmartGuideDirection(-9, 2)).toEqual({ x: "negative" });
    expect(dominantSmartGuideDirection(-2, 9)).toEqual({ z: "positive" });
  });

  it("does not activate guides before meaningful movement", () => {
    expect(dominantSmartGuideDirection(0.2, -0.24)).toEqual({});
  });

  it("finds the nearest centre match independently on X and Z", () => {
    const matches = findNearestCenterAlignments(moving, [
      { id: "eye-a", x: 10, z: -4 },
      { id: "eye-b", x: 11, z: -4.1 },
    ], 0.25);
    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({ axis: "x", referenceId: "eye-a", movingValue: 10.2, referenceValue: 10 });
    expect(matches[0].delta).toBeCloseTo(0.2);
    expect(matches[1]).toMatchObject({ axis: "z", referenceId: "eye-b", movingValue: -4.1, referenceValue: -4.1 });
    expect(matches[1].delta).toBeCloseTo(0);
  });

  it("does not produce guides outside the tolerance", () => {
    expect(findNearestCenterAlignments(moving, [{ id: "far", x: 13, z: -7 }], 0.5)).toEqual([]);
  });

  it("prefers the closest reference and preserves signed offset", () => {
    const matches = findNearestCenterAlignments(
      { id: "moving", x: 9.2, z: 0 },
      [
        { id: "near", x: 10, z: 0 },
        { id: "far", x: 10.4, z: 0 },
      ],
      1.5,
    );
    expect(matches[0]).toMatchObject({ axis: "x", referenceId: "near", movingValue: 9.2, referenceValue: 10 });
    expect(matches[0].delta).toBeCloseTo(-0.8);
  });

  it("finds the nearest side gap on each active drag axis", () => {
    const movingBounds: SmartGuideBounds = { id: "moving", x: 0, z: 0, minX: 10, maxX: 20, minZ: 10, maxZ: 20 };
    const matches = findDirectionalEdgeDistances(movingBounds, [
      { id: "right", x: 0, z: 0, minX: 24, maxX: 34, minZ: 10, maxZ: 20 },
      { id: "behind", x: 0, z: 0, minX: 10, maxX: 20, minZ: 23, maxZ: 33 },
    ], { x: "positive", z: "positive" }, 10);
    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({ axis: "x", direction: "positive", referenceId: "right", gap: 4, movingEdge: 20, referenceEdge: 24 });
    expect(matches[1]).toMatchObject({ axis: "z", direction: "positive", referenceId: "behind", gap: 3, movingEdge: 20, referenceEdge: 23 });
  });

  it("measures from the moving left edge to a containing shape's left side", () => {
    const matches = findDirectionalEdgeDistances(
      { id: "cylinder", x: 0, z: 0, minX: -8, maxX: 8, minZ: -8, maxZ: 8 },
      [{ id: "box", x: 0, z: 0, minX: -40, maxX: 40, minZ: -30, maxZ: 30 }],
      { x: "negative" },
      60,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ axis: "x", direction: "negative", referenceId: "box", gap: 32, movingEdge: -8, referenceEdge: -40 });
  });

  it("measures from the moving right edge to a containing shape's right side", () => {
    const matches = findDirectionalEdgeDistances(
      { id: "cylinder", x: 0, z: 0, minX: -8, maxX: 8, minZ: -8, maxZ: 8 },
      [{ id: "box", x: 0, z: 0, minX: -40, maxX: 40, minZ: -30, maxZ: 30 }],
      { x: "positive" },
      60,
    );
    expect(matches[0]).toMatchObject({ axis: "x", direction: "positive", referenceId: "box", gap: 32, movingEdge: 8, referenceEdge: 40 });
  });

  it("reports zero when the selected side reaches the reference side", () => {
    const matches = findDirectionalEdgeDistances(
      { id: "cylinder", x: 0, z: 0, minX: -40, maxX: -24, minZ: -8, maxZ: 8 },
      [{ id: "box", x: 0, z: 0, minX: -40, maxX: 40, minZ: -30, maxZ: 30 }],
      { x: "negative" },
      60,
    );
    expect(matches[0]).toMatchObject({ gap: 0, movingEdge: -40, referenceEdge: -40 });
  });

  it("does not emit inactive axes or distant references", () => {
    expect(findDirectionalEdgeDistances(
      { id: "moving", x: 0, z: 0, minX: 0, maxX: 10, minZ: 0, maxZ: 10 },
      [{ id: "far", x: 0, z: 0, minX: 100, maxX: 110, minZ: 100, maxZ: 110 }],
      { x: "negative" },
      5,
    )).toEqual([]);
  });
});
