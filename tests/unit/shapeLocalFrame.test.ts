import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { bakeCadMetadataForShapeTransform, cadModifierPrimitiveForBakedShape, cadTransformToMatrix } from "@/lib/cadBakeMetadata";
import { repeatShapeTransform } from "@/lib/duplicateRepeat";
import { editorHistoryEntry } from "@/lib/editorHistory";
import { cloneWorkplaneShapeSnapshot, edgeTreatmentAppliedFrame, restoreShapeBeforeEdgeTreatment } from "@/lib/edgeTreatmentHistory";
import { restoredProjectFromLegacyFile } from "@/lib/projectFile";
import {
  bakeWorldMeshIntoShape,
  orientationRecordForBake,
  resizeShapeInOwnFrame,
  shapeOwnFrame,
  type ShapeOwnFrame,
} from "@/lib/shapeLocalFrame";
import { exportSkfProject, importSkfProject } from "@/lib/skfProject";
import { canonicalizeShape, meshYawDegrees, mirrorSign } from "@/lib/workplaneShapes";
import { DEFAULT_SNAP_GRID, DEFAULT_WORKPLANE_WORKSPACE } from "@/lib/workplaneSettings";
import type { WorkplaneShape } from "@/types/sketchforge";

type Vec3 = [number, number, number];
const EPS = 1e-6;

function boxShape(overrides: Partial<WorkplaneShape> = {}): WorkplaneShape {
  return {
    id: "box-1",
    name: "Box",
    kind: "box",
    color: "#d41721",
    x: 5,
    z: -3,
    elevation: 0,
    size: 30,
    width: 20,
    depth: 30,
    height: 10,
    rotation: 0,
    rotationX: 0,
    rotationZ: 0,
    locked: false,
    hidden: false,
    ...overrides,
  };
}

// Same placement the editor's transformMesh applies: local mesh (y from 0 to
// height) -> mirror -> Euler XYZ rotation about the centre -> translate.
function placeVertices(shape: WorkplaneShape, local: Vec3[]): Vec3[] {
  const centerY = shape.height / 2;
  const rotation = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(shape.rotationX ?? 0),
    THREE.MathUtils.degToRad(meshYawDegrees(shape)),
    THREE.MathUtils.degToRad(shape.rotationZ ?? 0),
    "XYZ",
  ));
  return local.map(([x, y, z]) => {
    const vertex = new THREE.Vector3(x * mirrorSign(shape.mirrorX), (y - centerY) * mirrorSign(shape.mirrorY), z * mirrorSign(shape.mirrorZ)).applyMatrix4(rotation);
    return [vertex.x + shape.x, vertex.y + (shape.elevation ?? 0) + centerY, vertex.z + shape.z];
  });
}

const BOX_FACES: Vec3[] = [
  [0, 2, 1], [0, 3, 2], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4],
  [1, 2, 6], [1, 6, 5], [2, 3, 7], [2, 7, 6], [3, 0, 4], [3, 4, 7],
];

function boxLocalVertices(shape: WorkplaneShape): Vec3[] {
  const x = shape.width / 2;
  const z = shape.depth / 2;
  const h = shape.height;
  return [[-x, 0, -z], [x, 0, -z], [x, 0, z], [-x, 0, z], [-x, h, -z], [x, h, -z], [x, h, z], [-x, h, z]];
}

/** The editor's bake (rotate gesture end) for an analytic box or an imported mesh. */
function bake(shape: WorkplaneShape): WorkplaneShape {
  let vertices: Vec3[];
  let faces: Vec3[];
  if (shape.importedMesh) {
    const mesh = shape.importedMesh;
    const local: Vec3[] = [];
    for (let index = 0; index + 2 < mesh.positions.length; index += 3) {
      local.push([
        mesh.positions[index] * shape.width / mesh.baseWidth,
        mesh.positions[index + 1] * shape.height / mesh.baseHeight,
        mesh.positions[index + 2] * shape.depth / mesh.baseDepth,
      ]);
    }
    vertices = placeVertices(shape, local);
    faces = Array.from({ length: local.length / 3 }, (_, index) => [index * 3, index * 3 + 1, index * 3 + 2] as Vec3);
  } else {
    vertices = placeVertices(shape, boxLocalVertices(shape));
    faces = BOX_FACES;
  }
  return canonicalizeShape(bakeWorldMeshIntoShape(shape, { vertices, faces }, {
    cleanDimension: (value) => Math.max(0.01, Number(value.toFixed(3))),
    minDimension: 0.01,
    bakeCadMetadata: (frame) => bakeCadMetadataForShapeTransform(shape, { ...frame, yawDegrees: meshYawDegrees(shape) }),
  }));
}

/** World vertices exactly as the viewport renders a mesh shape (rotation fields must be 0 after a bake). */
function renderedWorldVertices(shape: WorkplaneShape): THREE.Vector3[] {
  const mesh = shape.importedMesh!;
  const vertices: THREE.Vector3[] = [];
  for (let index = 0; index + 2 < mesh.positions.length; index += 3) {
    vertices.push(new THREE.Vector3(
      shape.x + mesh.positions[index] * shape.width / mesh.baseWidth,
      (shape.elevation ?? 0) + mesh.positions[index + 1] * shape.height / mesh.baseHeight,
      shape.z + mesh.positions[index + 2] * shape.depth / mesh.baseDepth,
    ));
  }
  return vertices;
}

function axesOf(quaternion: THREE.Quaternion) {
  return [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)].map((axis) => axis.applyQuaternion(quaternion));
}

function eulerQuaternion(xDeg: number, yDeg: number, zDeg: number) {
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(
    THREE.MathUtils.degToRad(xDeg), THREE.MathUtils.degToRad(yDeg), THREE.MathUtils.degToRad(zDeg), "XYZ",
  ));
}

function expectVectorClose(actual: THREE.Vector3, expected: THREE.Vector3, tolerance = EPS) {
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(tolerance);
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(tolerance);
  expect(Math.abs(actual.z - expected.z)).toBeLessThan(tolerance);
}

function expectFrameAxes(frame: ShapeOwnFrame, expected: THREE.Quaternion) {
  const [x, y, z] = axesOf(expected);
  expectVectorClose(frame.xAxis, x);
  expectVectorClose(frame.yAxis, y);
  expectVectorClose(frame.zAxis, z);
}

/** Projected extents along the given axes, and whether every vertex sits on one of the two extreme planes of each axis. */
function projectOnto(vertices: THREE.Vector3[], axes: THREE.Vector3[]) {
  const projected = vertices.map((vertex) => axes.map((axis) => vertex.dot(axis)));
  const min = [0, 1, 2].map((index) => Math.min(...projected.map((entry) => entry[index])));
  const max = [0, 1, 2].map((index) => Math.max(...projected.map((entry) => entry[index])));
  const onBoxCorners = projected.every((entry) => entry.every((value, index) => Math.abs(value - min[index]) < EPS || Math.abs(value - max[index]) < EPS));
  return { min, max, span: max.map((value, index) => value - min[index]), onBoxCorners, projected };
}

/** Turn a baked shape about one of its own frame axes the way the rotate handle does, then bake. */
function rotateAboutOwnAxis(shape: WorkplaneShape, axis: "x" | "y" | "z", degrees: number) {
  const frame = shapeOwnFrame(shape);
  const vector = frame ? frame[`${axis}Axis`] : new THREE.Vector3(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0);
  const delta = new THREE.Quaternion().setFromAxisAngle(vector, THREE.MathUtils.degToRad(degrees));
  const euler = new THREE.Euler().setFromQuaternion(delta, "XYZ");
  return bake({
    ...shape,
    rotationX: THREE.MathUtils.radToDeg(euler.x),
    rotation: THREE.MathUtils.radToDeg(euler.y),
    rotationZ: THREE.MathUtils.radToDeg(euler.z),
  });
}

function resizeWidth(shape: WorkplaneShape, frame: ShapeOwnFrame, width: number) {
  // Keep the -X face where it is, as dragging the +X edge handle does.
  const center = frame.center.clone().addScaledVector(frame.xAxis, (width - frame.width) / 2);
  const patch = resizeShapeInOwnFrame(shape, frame, { center, width, height: frame.height, depth: frame.depth });
  expect(patch).not.toBeNull();
  return canonicalizeShape({ ...shape, ...patch });
}

describe("rotated shapes keep their own frame after the rotation is baked", () => {
  it("a 20×30×10 box rotated 30° about Y: frame on its own axes, true size, resize without shear", () => {
    const baked = bake(boxShape({ rotation: 30 }));
    expect(baked.kind).toBe("mesh");
    expect([baked.rotation, baked.rotationX, baked.rotationZ]).toEqual([0, 0, 0]);
    expect(baked.localFrame).toBeDefined();

    const expected = eulerQuaternion(0, 30, 0);
    const frame = shapeOwnFrame(baked)!;
    expect(frame).not.toBeNull();
    expectFrameAxes(frame, expected);
    expect(Math.abs(frame.width - 20)).toBeLessThan(EPS);
    expect(Math.abs(frame.depth - 30)).toBeLessThan(EPS);
    expect(Math.abs(frame.height - 10)).toBeLessThan(EPS);
    expectVectorClose(frame.center, new THREE.Vector3(5, 5, -3));

    const before = projectOnto(renderedWorldVertices(baked), axesOf(expected));
    const resized = resizeWidth(baked, frame, 40);
    const after = projectOnto(renderedWorldVertices(resized), axesOf(expected));
    expect(after.span[0]).toBeCloseTo(40, 6);
    expect(after.span[1]).toBeCloseTo(10, 6);
    expect(after.span[2]).toBeCloseTo(30, 6);
    expect(after.onBoxCorners).toBe(true);
    // The opposite (-X) face stayed put; the other faces did not move.
    expect(after.min[0]).toBeCloseTo(before.min[0], 6);
    expect(after.min[1]).toBeCloseTo(before.min[1], 6);
    expect(after.min[2]).toBeCloseTo(before.min[2], 6);

    // Orientation unchanged, frame follows, and the exact box primitive used
    // by chamfer/fillet is a rigid 40×30×10 box in the same place.
    expect(resized.localFrame?.quaternion).toEqual(baked.localFrame?.quaternion);
    const resizedFrame = shapeOwnFrame(resized)!;
    expectFrameAxes(resizedFrame, expected);
    expect(resizedFrame.width).toBeCloseTo(40, 6);
    const primitive = cadModifierPrimitiveForBakedShape(resized)!;
    expect([primitive.width, primitive.depth, primitive.height].map((value) => Number(value.toFixed(6)))).toEqual([40, 30, 10]);
    const transform = cadTransformToMatrix(primitive.transform);
    const columns = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    transform.extractBasis(columns[0], columns[1], columns[2]);
    columns.forEach((column, index) => expectVectorClose(column, axesOf(expected)[index]));
    const primitiveCorners = boxLocalVertices(boxShape({ width: 40, depth: 30, height: 10 }))
      .map(([x, y, z]) => new THREE.Vector3(x, y, z).applyMatrix4(transform));
    const meshCorners = projectOnto(renderedWorldVertices(resized), axesOf(expected));
    const cornerProjection = projectOnto(primitiveCorners, axesOf(expected));
    [0, 1, 2].forEach((index) => {
      expect(cornerProjection.min[index]).toBeCloseTo(meshCorners.min[index], 6);
      expect(cornerProjection.max[index]).toBeCloseTo(meshCorners.max[index], 6);
    });
  });

  it("composes a second rotation about the same axis: 30° then +20° is 50°", () => {
    const first = bake(boxShape({ rotation: 30 }));
    const second = rotateAboutOwnAxis(first, "y", 20);
    const frame = shapeOwnFrame(second)!;
    expectFrameAxes(frame, eulerQuaternion(0, 50, 0));
    expect(frame.width).toBeCloseTo(20, 6);
    expect(frame.depth).toBeCloseTo(30, 6);
    expect(frame.height).toBeCloseTo(10, 6);
  });

  it("a compound rotation (30° Y, then 45° about the box's own X) keeps a box frame and resizes without shear", () => {
    const first = bake(boxShape({ rotation: 30 }));
    const baked = rotateAboutOwnAxis(first, "x", 45);
    const expected = eulerQuaternion(0, 30, 0).multiply(eulerQuaternion(45, 0, 0));
    const frame = shapeOwnFrame(baked)!;
    expectFrameAxes(frame, expected);
    expect(frame.width).toBeCloseTo(20, 6);
    expect(frame.depth).toBeCloseTo(30, 6);
    expect(frame.height).toBeCloseTo(10, 6);

    const resized = resizeWidth(baked, frame, 40);
    const after = projectOnto(renderedWorldVertices(resized), axesOf(expected));
    expect(after.span[0]).toBeCloseTo(40, 6);
    expect(after.span[1]).toBeCloseTo(10, 6);
    expect(after.span[2]).toBeCloseTo(30, 6);
    expect(after.onBoxCorners).toBe(true);
    expectFrameAxes(shapeOwnFrame(resized)!, expected);
  });

  it("a rotated imported mesh keeps its orientation and scales along its own axes only", () => {
    // An asymmetric wedge-like STL body (not a box) 20 wide, 10 tall, 30 deep.
    const local: Vec3[] = [
      [-10, 0, -15], [10, 0, -15], [10, 0, 15],
      [-10, 0, -15], [10, 0, 15], [-10, 0, 15],
      [-10, 0, -15], [-10, 10, 15], [10, 0, 15],
      [-10, 0, -15], [-10, 10, 15], [-10, 0, 15],
      [10, 0, -15], [10, 0, 15], [-10, 10, 15],
    ];
    const stl = boxShape({
      id: "stl-1",
      kind: "mesh",
      importedMesh: {
        positions: local.flat(),
        baseWidth: 20,
        baseDepth: 30,
        baseHeight: 10,
        triangleCount: local.length / 3,
        sourceFormat: "stl",
      },
    });
    const baked = rotateAboutOwnAxis(rotateAboutOwnAxis(stl, "y", 30), "x", 45);
    const expected = eulerQuaternion(0, 30, 0).multiply(eulerQuaternion(45, 0, 0));
    const frame = shapeOwnFrame(baked)!;
    expectFrameAxes(frame, expected);
    expect(frame.width).toBeCloseTo(20, 6);
    expect(frame.height).toBeCloseTo(10, 6);
    expect(frame.depth).toBeCloseTo(30, 6);

    const axes = axesOf(expected);
    const before = projectOnto(renderedWorldVertices(baked), axes);
    const resized = resizeWidth(baked, frame, 40);
    const after = projectOnto(renderedWorldVertices(resized), axes);
    expect(after.span.map((value) => Number(value.toFixed(6)))).toEqual([40, 10, 30]);
    // Every vertex's own-frame coordinates: X doubled from the fixed -X face, Y and Z untouched.
    after.projected.forEach((entry, index) => {
      const original = before.projected[index];
      expect(entry[0] - after.min[0]).toBeCloseTo((original[0] - before.min[0]) * 2, 6);
      expect(entry[1]).toBeCloseTo(original[1], 6);
      expect(entry[2]).toBeCloseTo(original[2], 6);
    });
    expectFrameAxes(shapeOwnFrame(resized)!, expected);
  });

  it("keeps the frame through a mirror of a rotated mesh", () => {
    const baked = bake(boxShape({ rotation: 30 }));
    const mirrored = { ...baked, mirrorX: true };
    const frame = shapeOwnFrame(mirrored)!;
    // Mirroring across world X turns a 30° box into a -30° box.
    const [x, y, z] = axesOf(eulerQuaternion(0, -30, 0));
    expect(Math.abs(Math.abs(frame.xAxis.dot(x)) - 1)).toBeLessThan(EPS);
    expect(Math.abs(Math.abs(frame.yAxis.dot(y)) - 1)).toBeLessThan(EPS);
    expect(Math.abs(Math.abs(frame.zAxis.dot(z)) - 1)).toBeLessThan(EPS);
    expect(frame.width).toBeCloseTo(20, 6);
    expect(frame.depth).toBeCloseTo(30, 6);
    const rebaked = bake(mirrored);
    const rebakedFrame = shapeOwnFrame(rebaked)!;
    expect(Math.abs(Math.abs(rebakedFrame.xAxis.dot(x)) - 1)).toBeLessThan(EPS);
    expect(rebakedFrame.width).toBeCloseTo(20, 6);
  });

  it("leaves never-rotated and right-angle-rotated shapes on the usual frame", () => {
    expect(shapeOwnFrame(boxShape())).toBeNull();
    expect(orientationRecordForBake(boxShape({ mirrorX: true }))).toBeUndefined();
    expect(bake(boxShape({ mirrorX: true })).localFrame).toBeUndefined();
    const quarterTurn = bake(boxShape({ rotation: 90 }));
    expect(quarterTurn.localFrame).toBeDefined();
    expect(shapeOwnFrame(quarterTurn)).toBeNull();
    expect(quarterTurn.width).toBeCloseTo(30, 6);
    expect(quarterTurn.depth).toBeCloseTo(20, 6);
  });

  it("repeats a rotated mesh's rotation without reading it as growth", () => {
    const local: Vec3[] = [[-10, 0, -15], [10, 0, -15], [0, 10, 15]];
    const source = bake(boxShape({
      kind: "mesh",
      rotation: 30,
      importedMesh: { positions: local.flat(), baseWidth: 20, baseDepth: 30, baseHeight: 10, triangleCount: 1, sourceFormat: "stl" },
    }));
    const current = { ...rotateAboutOwnAxis(source, "y", 20), id: "copy" };
    const next = repeatShapeTransform(current, source);
    expect(next.rotation).toBeCloseTo(20, 1);
    expect(next.width).toBeCloseTo(current.width, 6);
    expect(next.depth).toBeCloseTo(current.depth, 6);
  });
});

describe("edge treatments on rotated shapes", () => {
  it("keeps an edge-treatment revert exact after resizing along the own frame", () => {
    const baked = bake(boxShape({ rotation: 30 }));
    const treated: WorkplaneShape = {
      ...baked,
      edgeTreatments: [{ kind: "chamfer", amount: 1, edgeCount: 12 }],
      edgeResizeMode: "scale",
      edgeTreatmentHistory: [{
        id: "edge-1",
        createdAt: 1,
        feature: { kind: "chamfer", amount: 1, edgeCount: 12 },
        before: cloneWorkplaneShapeSnapshot(baked),
        appliedFrame: edgeTreatmentAppliedFrame(baked),
      }],
    };
    const resized = resizeWidth(treated, shapeOwnFrame(treated)!, 40);
    const restored = restoreShapeBeforeEdgeTreatment(resized, resized.edgeTreatmentHistory![0]);
    const frame = shapeOwnFrame(restored)!;
    expectFrameAxes(frame, eulerQuaternion(0, 30, 0));
    expect(frame.width).toBeCloseTo(40, 6);
    expect(frame.depth).toBeCloseTo(30, 6);
    expect(frame.height).toBeCloseTo(10, 6);
    expect(projectOnto(renderedWorldVertices(restored), axesOf(eulerQuaternion(0, 30, 0))).onBoxCorners).toBe(true);
  });

  it("keeps preserved edge zones their size when resizing along the own frame", () => {
    // A slab whose top has a 1 mm-wide strip next to the -X face (like a chamfer).
    const local: Vec3[] = [
      [-10, 0, -15], [10, 0, -15], [10, 0, 15],
      [-10, 10, -15], [-9, 10, -15], [-9, 10, 15],
      [-9, 10, -15], [10, 10, -15], [10, 10, 15],
    ];
    const baked = bake(boxShape({
      kind: "mesh",
      rotation: 30,
      importedMesh: { positions: local.flat(), baseWidth: 20, baseDepth: 30, baseHeight: 10, triangleCount: 3, sourceFormat: "json" },
    }));
    const treated = { ...baked, edgeTreatments: [{ kind: "chamfer" as const, amount: 2, edgeCount: 4 }], edgeResizeMode: "preserve" as const };
    const frame = shapeOwnFrame(treated)!;
    const resized = resizeWidth(treated, frame, 40);
    const axes = axesOf(eulerQuaternion(0, 30, 0));
    const after = projectOnto(renderedWorldVertices(resized), axes);
    expect(after.span[0]).toBeCloseTo(40, 6);
    const stripOffsets = after.projected.map((entry) => entry[0] - after.min[0]).filter((offset) => offset > 0.5 && offset < 5);
    expect(stripOffsets.length).toBeGreaterThan(0);
    stripOffsets.forEach((offset) => expect(offset).toBeCloseTo(1, 6));
  });
});

describe("orientation record persistence", () => {
  it("round-trips through .skf save and load", async () => {
    const baked = bake(boxShape({ rotation: 30 }));
    const shapes = [baked];
    const exported = await exportSkfProject({
      projectId: "p",
      projectName: "Rotated",
      createdAt: 1_700_000_000_000,
      modifiedAt: 1_700_000_100_000,
      shapes,
      history: [editorHistoryEntry(shapes, [])],
      historyIndex: 0,
      assets: [],
      workspace: DEFAULT_WORKPLANE_WORKSPACE,
      snapGrid: DEFAULT_SNAP_GRID,
      placementElevation: 0,
    });
    const restored = await importSkfProject(exported);
    const shape = restored.shapes[0];
    expect(shape.localFrame?.quaternion).toEqual(baked.localFrame?.quaternion);
    const frame = shapeOwnFrame(shape)!;
    expectFrameAxes(frame, eulerQuaternion(0, 30, 0));
    expect(frame.width).toBeCloseTo(20, 6);
    expect(frame.depth).toBeCloseTo(30, 6);
  });

  it("legacy .sketchforge files open with or without the record", () => {
    const baked = bake(boxShape({ rotation: 30 }));
    const { localFrame, ...withoutRecord } = baked;
    const file = (shapes: unknown[]) => JSON.stringify({ format: "sketchforge-project", version: 1, project: { name: "Old", shapes } });
    const opened = restoredProjectFromLegacyFile(file([withoutRecord, { ...baked, id: "second", localFrame: { quaternion: ["bad"] } }]));
    expect(opened.shapes).toHaveLength(2);
    expect(opened.shapes[0].localFrame).toBeUndefined();
    expect(opened.shapes[1].localFrame).toBeUndefined();
    // A rotated box from before the record existed still finds its frame from its CAD primitive.
    expect(shapeOwnFrame({ ...withoutRecord, cadPrimitiveFrame: baked.cadPrimitiveFrame })?.width).toBeCloseTo(20, 6);
    const reopened = restoredProjectFromLegacyFile(file([baked]));
    expect(reopened.shapes[0].localFrame?.quaternion).toEqual(localFrame?.quaternion);
  });
});
