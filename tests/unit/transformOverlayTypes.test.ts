import { describe, expect, it } from "vitest";
import {
  MIN_LIFT_HANDLE_SCREEN_GAP,
  ROTATION_PROTRACTOR_RADIUS,
  projectedMoveHandle,
  projectedRotationWheel,
  rotationWheelLocalRadius,
  rotationWheelPoint,
  screenRotationWheel,
  separatedLiftHandlePoint,
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
});
