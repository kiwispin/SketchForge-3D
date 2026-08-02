import { describe, expect, it } from "vitest";
import {
  MIN_LIFT_HANDLE_SCREEN_GAP,
  ROTATION_PROTRACTOR_RADIUS,
  WORLD_ROTATION_PLANES,
  buildRotationPlaneDescriptor,
  projectedMoveHandle,
  projectedRotationWheel,
  rotationHandleLocalAnchor,
  rotationWheelLocalRadius,
  rotationWheelPoint,
  rotationSnapDelta,
  signedAngleAroundAxis,
  orthographicFitZoom,
  screenRotationWheel,
  separatedLiftHandlePoint,
  unwrapRadians,
  type WorldVec3,
} from "@/components/workplane/transformOverlayTypes";

describe("transform overlay geometry", () => {
  it("places a movement handle along the projected world axis", () => {
    expect(projectedMoveHandle({ x: 100, y: 100 }, { x: 110, y: 100 }, 0)).toEqual({
      x: 136,
      y: 100,
      angle: 0,
    });
  });

  it("uses a stable fallback for an axis viewed end-on", () => {
    const point = projectedMoveHandle({ x: 100, y: 100 }, { x: 100, y: 100 }, Math.PI / 2);
    expect(point.x).toBeCloseTo(100);
    expect(point.y).toBeCloseTo(136);
    expect(point.angle).toBeCloseTo(90);
  });

  it("keeps an already-separated lift handle in its projected position", () => {
    expect(separatedLiftHandlePoint({ x: 100, y: 100 }, { x: 100, y: 60 }, false)).toEqual({ x: 100, y: 60 });
  });

  it("pushes a close lift handle to the minimum screen-space gap", () => {
    const point = separatedLiftHandlePoint({ x: 100, y: 100 }, { x: 103, y: 96 }, false);
    expect(Math.hypot(point.x - 100, point.y - 100)).toBeCloseTo(MIN_LIFT_HANDLE_SCREEN_GAP);
    expect(point.x).toBeGreaterThan(100);
    expect(point.y).toBeLessThan(100);
  });

  it("uses a stable vertical fallback when world height projects to one point", () => {
    expect(separatedLiftHandlePoint({ x: 100, y: 100 }, { x: 100, y: 100 }, false)).toEqual({ x: 100, y: 68 });
    expect(separatedLiftHandlePoint({ x: 100, y: 100 }, { x: 100, y: 100 }, true)).toEqual({ x: 100, y: 132 });
  });

  it("centers the rotation protractor on the visible selection pivot", () => {
    expect(screenRotationWheel({ x: 430, y: 280 }, { width: 1200, height: 800 })).toEqual({
      x: 430,
      y: 280,
      radius: ROTATION_PROTRACTOR_RADIUS,
    });
  });

  it("keeps the rotation protractor compact in a small viewport", () => {
    const wheel = screenRotationWheel({ x: 80, y: 60 }, { width: 150, height: 120 });
    expect(wheel).toEqual({ x: 80, y: 60, radius: 42 });
  });

  it("projects a fixed-size rotation guide into the selected plane", () => {
    const wheel = projectedRotationWheel(
      { x: 200, y: 150 },
      { x: 100, y: 0 },
      { x: 0, y: 50 },
      { x: 0, y: -20 },
      { width: 1200, height: 800 },
    );
    expect(wheel.radius).toBe(ROTATION_PROTRACTOR_RADIUS);
    expect(wheel.matrix?.[0]).toBeCloseTo(1);
    expect(wheel.matrix?.[3]).toBeCloseTo(0.5);
    expect(rotationWheelPoint(wheel, 0)).toEqual({ x: 200, y: 66 });
    expect(rotationWheelLocalRadius(wheel, { x: 200, y: 66 })).toBeCloseTo(ROTATION_PROTRACTOR_RADIUS);
  });

  it("keeps each rotation axis assigned to a stable frame corner", () => {
    expect(rotationHandleLocalAnchor("x", { width: 20, height: 40, depth: 60 })).toEqual({ x: -10, y: 20, z: 30 });
    expect(rotationHandleLocalAnchor("z", { width: 20, height: 40, depth: 60 })).toEqual({ x: 10, y: 20, z: -30 });
    expect(rotationHandleLocalAnchor("y", { width: 20, height: 40, depth: 60 })).toEqual({ x: 10, y: -20, z: 30 });
  });

  it("uses coarse inner-zone and fine outer-zone rotation snapping", () => {
    expect(rotationSnapDelta(17, 80, 168)).toBe(22.5);
    expect(rotationSnapDelta(17, 190, 168)).toBe(17);
    expect(rotationSnapDelta(28, 80, 168, true)).toBe(45);
  });

  it("fits an orthographic view from projected selection spans", () => {
    expect(orthographicFitZoom({ width: 1000, height: 800 }, 200, 100, 1.25)).toBe(4);
  });
});

describe("shared rotation-plane descriptor (Stage 1)", () => {
  const viewport = { width: 1200, height: 800 };

  it("assigns X/Y/Z by world-plane identity, not frame-local corners", () => {
    // A pre-rotated rectangular box (30° about Y) must NOT reorient the handles.
    expect(WORLD_ROTATION_PLANES.x.axisVector).toEqual({ x: 1, y: 0, z: 0 });
    expect(WORLD_ROTATION_PLANES.y.axisVector).toEqual({ x: 0, y: 1, z: 0 });
    expect(WORLD_ROTATION_PLANES.z.axisVector).toEqual({ x: 0, y: 0, z: 1 });
  });

  it("projects the world rotation plane into the wheel matrix", () => {
    const pivot = { x: 4, y: 6, z: -3 };
    const project = (point: WorldVec3) => ({
      x: point.x * 1.5 - point.z * 0.4 + 600,
      y: point.y * 1.0 + point.z * 0.3 + 400,
    });
    const descriptor = buildRotationPlaneDescriptor("y", pivot, project, { x: 700, y: 300 }, viewport);
    expect(descriptor.axisVector).toEqual({ x: 0, y: 1, z: 0 });
    expect(descriptor.screenCenter).toEqual(project(pivot));
    // screenU is the projected +X axis, screenV the projected +Z axis.
    expect(descriptor.screenU.x).toBeCloseTo(project({ x: pivot.x + 1, y: pivot.y, z: pivot.z }).x - project(pivot).x, 5);
    expect(descriptor.screenV.y).toBeCloseTo(project({ x: pivot.x, y: pivot.y, z: pivot.z + 1 }).y - project(pivot).y, 5);
    expect(descriptor.wheel.radius).toBe(ROTATION_PROTRACTOR_RADIUS);
    const length = Math.hypot(descriptor.screenU.x, descriptor.screenU.y);
    expect(descriptor.wheel.matrix?.[0]).toBeCloseTo(descriptor.screenU.x / Math.max(length, 0.0001), 5);
  });

  it("measures a signed angle around the shared world axis", () => {
    // Rotating +X by 90° about world Y should give +90°.
    expect(signedAngleAroundAxis({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 })).toBeCloseTo(Math.PI / 2, 5);
    // Opposite direction is -90°.
    expect(signedAngleAroundAxis({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 1, z: 0 })).toBeCloseTo(-Math.PI / 2, 5);
  });

  it("unwrapRadians keeps angles within one turn", () => {
    expect(unwrapRadians(Math.PI + 0.5)).toBeCloseTo(-Math.PI + 0.5, 5);
    expect(unwrapRadians(-Math.PI - 0.5)).toBeCloseTo(Math.PI - 0.5, 5);
    expect(unwrapRadians(0.3)).toBeCloseTo(0.3, 5);
  });
});
