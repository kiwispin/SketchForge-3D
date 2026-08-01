import { describe, expect, it } from "vitest";
import { duplicateRepeatMatches, repeatShapeTransform } from "@/lib/duplicateRepeat";
import type { WorkplaneShape } from "@/types/sketchforge";

const shape = (overrides: Partial<WorkplaneShape> = {}): WorkplaneShape => ({
  id: "shape",
  name: "Box",
  kind: "box",
  color: "#fff",
  x: 0,
  z: 0,
  elevation: 0,
  size: 20,
  width: 20,
  depth: 20,
  height: 20,
  rotation: 0,
  rotationX: 0,
  rotationZ: 0,
  locked: false,
  hidden: false,
  ...overrides,
});

describe("duplicate and repeat", () => {
  it("matches only the duplicate selection that owns the remembered pattern", () => {
    expect(duplicateRepeatMatches({ selectedIds: ["copy"], sourceShapes: [shape()] }, ["copy"])).toBe(true);
    expect(duplicateRepeatMatches({ selectedIds: ["copy"], sourceShapes: [shape()] }, ["other"])).toBe(false);
  });

  it("repeats movement, lift, rotation, and scale deltas", () => {
    const source = shape();
    const current = shape({ id: "copy", x: 20, z: 4, elevation: 3, width: 30, depth: 10, height: 40, size: 30, rotation: 15, rotationX: 5, rotationZ: -10 });
    const next = repeatShapeTransform(current, source);
    expect(next.x).toBe(40);
    expect(next.z).toBe(8);
    expect(next.elevation).toBe(6);
    expect(next.width).toBe(45);
    expect(next.depth).toBe(5);
    expect(next.height).toBe(80);
    expect(next.rotation).toBe(30);
    expect(next.rotationX).toBe(10);
    expect(next.rotationZ).toBe(-20);
  });
});
