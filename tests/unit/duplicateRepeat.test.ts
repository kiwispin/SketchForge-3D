import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { cadTransformFromMatrix } from "@/lib/cadBakeMetadata";
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

  it("repeats a baked rotation as rotation, not as scale growth", () => {
    // A 20×20×20 box rotated 39° about Y was baked into a mesh. Baking zeroes
    // the rotation field and grows width/depth to the axis-aligned bounds
    // (~28.1), but cadPrimitiveFrame.frame.sourceTransform preserves the true
    // rotation and primitive dimensions. The repeat must replay the rotation
    // delta and not inflate the mesh as if it had been scaled.
    const source = shape();
    const yawMatrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, THREE.MathUtils.degToRad(39), 0, "XYZ"));
    const baked = shape({
      id: "copy",
      kind: "mesh",
      x: 2,
      z: 2,
      width: 28.129,
      depth: 28.129,
      height: 20,
      size: 28.129,
      rotation: 0,
      rotationX: 0,
      rotationZ: 0,
      importedMesh: {
        positions: [],
        baseWidth: 28.129,
        baseDepth: 28.129,
        baseHeight: 20,
        triangleCount: 12,
        sourceFormat: "json" as const,
      },
      cadPrimitiveFrame: {
        kind: "box",
        width: 20,
        depth: 20,
        height: 20,
        frame: {
          x: 2,
          z: 2,
          elevation: 0,
          width: 28.129,
          depth: 28.129,
          height: 20,
          sourceTransform: cadTransformFromMatrix(yawMatrix),
        },
      },
    });
    const next = repeatShapeTransform(baked, source);
    // Position delta repeats (+2), rotation delta repeats (+39°), and the
    // primitive dimensions stay 20 so width is NOT grown by the repeat.
    expect(next.x).toBe(4);
    expect(next.z).toBe(4);
    expect(next.rotation).toBeCloseTo(39, 1);
    expect(next.rotationX).toBeCloseTo(0, 1);
    expect(next.rotationZ).toBeCloseTo(0, 1);
    expect(next.width).toBeCloseTo(28.129, 1);
    expect(next.depth).toBeCloseTo(28.129, 1);
    expect(next.height).toBe(20);
  });

  it("applies a non-identity sourceTransform to the rotation delta", () => {
    // Source already rotated 15° about Y; duplicate baked at +39° more.
    const source = shape({ rotation: 15 });
    const yawMatrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, THREE.MathUtils.degToRad(54), 0, "XYZ"));
    const baked = shape({
      id: "copy",
      kind: "mesh",
      x: 2,
      z: 2,
      width: 28.129,
      depth: 28.129,
      height: 20,
      size: 28.129,
      rotation: 0,
      rotationX: 0,
      rotationZ: 0,
      cadPrimitiveFrame: {
        kind: "box",
        width: 20,
        depth: 20,
        height: 20,
        frame: {
          x: 2,
          z: 2,
          elevation: 0,
          width: 28.129,
          depth: 28.129,
          height: 20,
          sourceTransform: cadTransformFromMatrix(yawMatrix),
        },
      },
    });
    const next = repeatShapeTransform(baked, source);
    expect(next.rotation).toBeCloseTo(39, 1);
  });
});
