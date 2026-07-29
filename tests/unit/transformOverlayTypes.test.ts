import { describe, expect, it } from "vitest";
import {
  MIN_LIFT_HANDLE_SCREEN_GAP,
  projectedMoveHandle,
  projectedRotationArc,
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

  it("builds a curved arrow on the outward side of its projected rotation plane", () => {
    const arc = projectedRotationArc(
      { x: 100, y: 100, a: 1, b: 0, c: 0, d: 1 },
      { x: 180, y: 100 },
      20,
      90,
    );

    expect(arc.points).toHaveLength(19);
    expect(arc.points[9]).toMatchObject({ x: 180, y: 100 });
    expect(Math.min(...arc.points.map((point) => point.x))).toBeGreaterThan(173);
    expect(arc.arrow[0]).toEqual(arc.points[18]);
  });

  it("projects the same rotation arc as an ellipse when the plane is foreshortened", () => {
    const arc = projectedRotationArc(
      { x: 80, y: 60, a: 1.4, b: 0.1, c: 0.15, d: 0.35 },
      { x: 160, y: 70 },
      20,
      90,
    );
    const width = Math.max(...arc.points.map((point) => point.x)) - Math.min(...arc.points.map((point) => point.x));
    const height = Math.max(...arc.points.map((point) => point.y)) - Math.min(...arc.points.map((point) => point.y));

    expect(width).toBeGreaterThan(height);
    expect(height).toBeLessThan(12);
    expect(arc.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
  });

  it("keeps an edge-on rotation handle finite", () => {
    const arc = projectedRotationArc(
      { x: 40, y: 50, a: 1, b: 0, c: 0, d: 0 },
      { x: 90, y: 50 },
    );

    expect(arc.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
    expect(arc.arrow.flatMap((point) => [point.x, point.y]).every(Number.isFinite)).toBe(true);
  });
});
