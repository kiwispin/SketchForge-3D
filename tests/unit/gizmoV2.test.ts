import { describe, expect, it } from "vitest";
import {
  cameraYawInSelectionFrame,
  createRotationPresentationState,
  lowerRotationFaceAnchor,
  nearestPresentationFace,
  placeRigidRotationGlyph,
  projectedRotationGlyphMatrix,
  rotationControlsHidden,
  rotationGlyphAngleTowardFace,
  rotationPlaneFacing,
  upperRotationFaceAnchor,
  upperRotationScreenSlots,
  updateRotationPresentationState,
} from "@/components/workplane/gizmoV2";

describe("Tinkercad-style gizmo V2 presentation", () => {
  it("maps camera yaw to the nearest vertical presentation face", () => {
    expect(nearestPresentationFace(0)).toBe("z-max");
    expect(nearestPresentationFace(Math.PI / 2)).toBe("x-max");
    expect(nearestPresentationFace(Math.PI)).toBe("z-min");
    expect(nearestPresentationFace(-Math.PI / 2)).toBe("x-min");
  });

  it("hands the lower control to the next face after a five-degree orbit", () => {
    const initial = createRotationPresentationState("box", 0);
    expect(updateRotationPresentationState(initial, "box", 4 * Math.PI / 180).face).toBe("z-max");
    expect(updateRotationPresentationState(initial, "box", 6 * Math.PI / 180).face).toBe("x-max");
  });

  it("hands the control in the opposite direction when orbit direction reverses", () => {
    const initial = createRotationPresentationState("box", 0);
    expect(updateRotationPresentationState(initial, "box", -6 * Math.PI / 180).face).toBe("x-min");
  });

  it("resets presentation identity for a new selection", () => {
    const previous = createRotationPresentationState("first", 0);
    expect(updateRotationPresentationState(previous, "second", Math.PI / 2).face).toBe("x-max");
  });

  it("computes yaw in the selection's local horizontal frame", () => {
    expect(cameraYawInSelectionFrame(
      { x: 10, y: 5, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
    )).toBeCloseTo(Math.PI / 2);
  });

  it("anchors each presentation to the bottom midpoint of its face", () => {
    const bounds = { min: { x: -10, y: 0, z: -8 }, max: { x: 10, y: 20, z: 8 } };
    expect(lowerRotationFaceAnchor("z-max", bounds)).toEqual({
      point: { x: 0, y: 0, z: 8 },
      outward: { x: 0, y: 0, z: 1 },
    });
    expect(lowerRotationFaceAnchor("x-min", bounds)).toEqual({
      point: { x: -10, y: 0, z: 0 },
      outward: { x: -1, y: 0, z: 0 },
    });
  });

  it("anchors upper X and Z controls to separate camera-facing top edges", () => {
    const bounds = { min: { x: -10, y: 0, z: -8 }, max: { x: 10, y: 20, z: 8 } };
    expect(upperRotationFaceAnchor("x", { x: 5, y: 4, z: 6 }, bounds)).toEqual({
      point: { x: 10, y: 20, z: 0 },
      outward: { x: 1, y: 0.72, z: 0 },
      face: "x-max",
    });
    expect(upperRotationFaceAnchor("z", { x: 5, y: 4, z: 6 }, bounds)).toEqual({
      point: { x: 0, y: 20, z: 8 },
      outward: { x: 0, y: 0.72, z: 1 },
      face: "z-max",
    });
  });

  it("projects one symmetric glyph as a single affine plane primitive", () => {
    const faceOn = projectedRotationGlyphMatrix({ x: 10, y: 0 }, { x: 0, y: 5 });
    expect(faceOn[0]).toBeCloseTo(1);
    expect(faceOn[1]).toBeCloseTo(0);
    expect(faceOn[2]).toBeCloseTo(0);
    expect(faceOn[3]).toBeCloseTo(0.6);
    expect(projectedRotationGlyphMatrix({ x: 0, y: 10 }, { x: 0, y: 0 })).toEqual([0, 1, -0.6, 0]);
  });

  it("suppresses only vertical rotation planes that are edge-on", () => {
    expect(rotationPlaneFacing({ x: 0, y: 2, z: 10 }, "x")).toBeCloseTo(0);
    expect(rotationPlaneFacing({ x: 0, y: 2, z: 10 }, "z")).toBeGreaterThan(0.9);
  });

  it("places upper controls above the top center on opposite sides", () => {
    expect(upperRotationScreenSlots(
      { x: 100, y: 140 },
      { x: 100, y: 100 },
      { x: 130, y: 100 },
      { x: 70, y: 100 },
    )).toEqual({
      x: { x: 131, y: 66 },
      z: { x: 69, y: 66 },
    });
  });

  it("places a rigid glyph outward from the exact face anchor", () => {
    expect(placeRigidRotationGlyph({ x: 100, y: 100 }, { x: 100, y: 110 }, { x: 100, y: 70 }, 52)).toEqual({
      x: 100,
      y: 152,
    });
  });

  it("orients the canonical open side back toward the face", () => {
    expect(rotationGlyphAngleTowardFace({ x: 100, y: 152 }, { x: 100, y: 100 })).toBeCloseTo(0);
    expect(rotationGlyphAngleTowardFace({ x: 134, y: 100 }, { x: 100, y: 100 })).toBeCloseTo(-90);
  });

  it("hides rotation controls throughout camera interaction and damping", () => {
    expect(rotationControlsHidden(true, false)).toBe(true);
    expect(rotationControlsHidden(false, true)).toBe(true);
    expect(rotationControlsHidden(false, false)).toBe(false);
  });
});
