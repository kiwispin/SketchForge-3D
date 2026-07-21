import { describe, expect, it } from "vitest";
import { MIN_LIFT_HANDLE_SCREEN_GAP, projectedMoveHandle, separatedLiftHandlePoint } from "@/components/workplane/transformOverlayTypes";

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
});
