import * as THREE from "three";
import {
  cadBrepTransformForShape,
  cadModifierPrimitiveForBakedShape,
  cadTransformFromMatrix,
  cadTransformToMatrix,
} from "@/lib/cadBakeMetadata";
import { cloneWorkplaneShapeSnapshot, edgeTreatmentAppliedFrame, restoreShapeBeforeEdgeTreatment } from "@/lib/edgeTreatmentHistory";
import {
  cleanNearZero,
  edgePreservedCoordinate,
  edgeTreatmentPreserveZone,
  meshYawDegrees,
  mirroredAxisCount,
  mirrorSign,
  normalizeShapeLocalFrame,
  preservesEdgeTreatmentSize,
  resizedImportedCoordinates,
  shapeDepth,
  shapeWidth,
} from "@/lib/workplaneShapes";
import type { ShapeLocalFrame, WorkplaneShape } from "@/types/sketchforge";

/*
 * A shape's own frame.
 *
 * Rotating a shape bakes the rotation into world-space mesh positions (the
 * rotation fields return to 0 and width/depth/height become the world
 * axis-aligned bounds). The bake remembers the orientation in
 * `shape.localFrame`, and everything here works from that record: the
 * selection frame of a single rotated shape follows its own axes and hugs its
 * true size, and a resize scales the mesh along those axes instead of the
 * world axes (which would shear it).
 *
 * The orientation of what is on screen is R · M · Q: the live rotation fields
 * R (non-zero only mid-gesture or for shapes that were never baked), the
 * mirror flags M, and the baked record Q. Only meshes carry Q; analytic
 * primitives are generated in their own frame.
 */

export type AxisTriple = [THREE.Vector3, THREE.Vector3, THREE.Vector3];

export type ShapeOwnFrame = {
  center: THREE.Vector3;
  quaternion: THREE.Quaternion;
  xAxis: THREE.Vector3;
  yAxis: THREE.Vector3;
  zAxis: THREE.Vector3;
  width: number;
  height: number;
  depth: number;
};

export type FrameBox = {
  center: THREE.Vector3;
  xAxis: THREE.Vector3;
  yAxis: THREE.Vector3;
  zAxis: THREE.Vector3;
  width: number;
  height: number;
  depth: number;
};

const WORLD_AXES: AxisTriple = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
// |cos| above this counts as parallel (about 0.08°, below the 0.1° rotation precision).
const AXIS_ALIGNMENT_TOLERANCE = 1e-6;
const MIN_FRAME_SIZE = 0.01;

export function fieldRotationQuaternion(shape: WorkplaneShape, yawDegrees = shape.rotation ?? 0) {
  return new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(shape.rotationX ?? 0),
      THREE.MathUtils.degToRad(yawDegrees),
      THREE.MathUtils.degToRad(shape.rotationZ ?? 0),
      "XYZ",
    ),
  );
}

function basisColumns(matrix: THREE.Matrix4): AxisTriple {
  const x = new THREE.Vector3();
  const y = new THREE.Vector3();
  const z = new THREE.Vector3();
  matrix.extractBasis(x, y, z);
  return [x, y, z];
}

/** Gram-Schmidt: the closest rotation-ish basis to a possibly scaled or sheared one. */
function orthonormalColumns(matrix: THREE.Matrix4): THREE.Matrix4 | null {
  const [x, y, z] = basisColumns(matrix);
  if (x.lengthSq() < 1e-18 || y.lengthSq() < 1e-18 || z.lengthSq() < 1e-18) return null;
  x.normalize();
  y.addScaledVector(x, -y.dot(x));
  if (y.lengthSq() < 1e-18) return null;
  y.normalize();
  const handed = z.dot(new THREE.Vector3().crossVectors(x, y)) >= 0 ? 1 : -1;
  const zOrtho = new THREE.Vector3().crossVectors(x, y).multiplyScalar(handed);
  return new THREE.Matrix4().makeBasis(x, y, zOrtho);
}

/** The baked orientation record of a mesh: `localFrame`, or for older files the rotation kept in a baked box's CAD frame. */
function recordRotationMatrix(shape: WorkplaneShape): THREE.Matrix4 | null {
  if (!shape.importedMesh) return null;
  const record = normalizeShapeLocalFrame(shape.localFrame);
  if (record) {
    const [x, y, z, w] = record.quaternion;
    return new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion(x, y, z, w).normalize());
  }
  const sourceTransform = shape.cadPrimitiveFrame?.kind === "box" ? shape.cadPrimitiveFrame.frame?.sourceTransform : undefined;
  if (sourceTransform && sourceTransform.length === 12 && sourceTransform.every(Number.isFinite)) {
    return orthonormalColumns(cadTransformToMatrix(sourceTransform));
  }
  return null;
}

const SIGN_PATTERNS: Array<[number, number, number]> = [
  [1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1],
  [-1, 1, 1], [1, -1, 1], [1, 1, -1], [-1, -1, -1],
];

/**
 * Turn a (possibly reflected) basis into a rotation describing the same three
 * axis lines, choosing the column signs closest to `reference`.
 */
function properRotation(basis: THREE.Matrix4, reference: THREE.Matrix4) {
  const columns = basisColumns(basis);
  const referenceColumns = basisColumns(reference);
  const reflected = basis.determinant() < 0;
  let best: { score: number; signs: [number, number, number] } | null = null;
  SIGN_PATTERNS.forEach((signs) => {
    const negatives = signs.filter((sign) => sign < 0).length;
    // An odd number of flips toggles handedness.
    if ((negatives % 2 === 1) !== reflected) return;
    const score = signs.reduce((total, sign, index) => total + sign * columns[index].dot(referenceColumns[index]), 0);
    if (!best || score > best.score + 1e-12) best = { score, signs };
  });
  const signs = (best as { signs: [number, number, number] } | null)?.signs ?? [1, 1, 1];
  return new THREE.Matrix4().makeBasis(
    columns[0].clone().multiplyScalar(signs[0]),
    columns[1].clone().multiplyScalar(signs[1]),
    columns[2].clone().multiplyScalar(signs[2]),
  );
}

/**
 * The orientation of the shape's own axes as displayed (R · M · Q as a proper
 * rotation). `yawDegrees` lets the bake use the same effective yaw it applies
 * to round primitives.
 */
export function shapeOrientationQuaternion(shape: WorkplaneShape, yawDegrees = shape.rotation ?? 0) {
  const rotation = new THREE.Matrix4().makeRotationFromQuaternion(fieldRotationQuaternion(shape, yawDegrees));
  const record = recordRotationMatrix(shape);
  const withoutMirror = record ? rotation.clone().multiply(record) : rotation.clone();
  const mirror = new THREE.Matrix4().makeScale(mirrorSign(shape.mirrorX), mirrorSign(shape.mirrorY), mirrorSign(shape.mirrorZ));
  const displayed = rotation.clone().multiply(mirror);
  if (record) displayed.multiply(record);
  return new THREE.Quaternion().setFromRotationMatrix(properRotation(displayed, withoutMirror)).normalize();
}

function localFrameFromQuaternion(quaternion: THREE.Quaternion): ShapeLocalFrame | undefined {
  const normalized = quaternion.clone().normalize();
  // Store a canonical sign (w >= 0) and drop float dust so saves are stable.
  const sign = normalized.w < 0 ? -1 : 1;
  const values = [normalized.x, normalized.y, normalized.z, normalized.w].map((value) => {
    const signed = value * sign;
    return Math.abs(signed) < 1e-15 ? 0 : signed;
  }) as [number, number, number, number];
  return normalizeShapeLocalFrame({ quaternion: values });
}

/**
 * The orientation record a shape should carry once its current transform
 * (rotation fields, mirror flags and any earlier record) is baked into
 * world-space positions. Undefined when the result is not rotated at all.
 */
export function orientationRecordForBake(shape: WorkplaneShape): ShapeLocalFrame | undefined {
  return localFrameFromQuaternion(shapeOrientationQuaternion(shape, meshYawDegrees(shape)));
}

function axesFromQuaternion(quaternion: THREE.Quaternion): AxisTriple {
  return [
    new THREE.Vector3(1, 0, 0).applyQuaternion(quaternion).normalize(),
    new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion).normalize(),
    new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).normalize(),
  ];
}

/** True when every axis lies along one of the reference axes (a frame that only permutes or flips them). */
export function axesAlignedWith(axes: AxisTriple, reference: AxisTriple = WORLD_AXES, tolerance = AXIS_ALIGNMENT_TOLERANCE) {
  return axes.every((axis) => reference.some((candidate) => Math.abs(Math.abs(axis.dot(candidate)) - 1) <= tolerance));
}

/**
 * The axes of a shape's own selection frame, or null when the shape is not
 * turned relative to the reference axes (then the usual frame already hugs it).
 * The frame is flipped about its X axis when needed so its Y axis never points
 * down; a frame is a box, so that only relabels its faces.
 */
export function shapeOwnFrameAxes(shape: WorkplaneShape, reference: AxisTriple = WORLD_AXES) {
  const quaternion = shapeOrientationQuaternion(shape);
  let axes = axesFromQuaternion(quaternion);
  if (axesAlignedWith(axes, reference)) return null;
  if (axes[1].y < -1e-9) {
    quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI));
    axes = axesFromQuaternion(quaternion);
  }
  return { quaternion, xAxis: axes[0], yAxis: axes[1], zAxis: axes[2] };
}

function shapeCenter(shape: WorkplaneShape) {
  return new THREE.Vector3(shape.x, (shape.elevation ?? 0) + shape.height / 2, shape.z);
}

function shapeLocalToWorldMatrix(shape: WorkplaneShape) {
  const centerY = shape.height / 2;
  return new THREE.Matrix4()
    .makeTranslation(shape.x, (shape.elevation ?? 0) + centerY, shape.z)
    .multiply(new THREE.Matrix4().makeRotationFromQuaternion(fieldRotationQuaternion(shape)))
    .multiply(new THREE.Matrix4().makeScale(mirrorSign(shape.mirrorX), mirrorSign(shape.mirrorY), mirrorSign(shape.mirrorZ)))
    .multiply(new THREE.Matrix4().makeTranslation(0, -centerY, 0));
}

/** Map coordinates stored in an imported mesh's frame (as positions/display edges are) to world space. */
export function importedCoordinatesToWorld(shape: WorkplaneShape, coordinates: number[]) {
  const resized = resizedImportedCoordinates(shape, coordinates);
  const matrix = shapeLocalToWorldMatrix(shape);
  const elements = matrix.elements;
  const world = new Array<number>(resized.length);
  for (let index = 0; index + 2 < resized.length; index += 3) {
    const x = resized[index];
    const y = resized[index + 1];
    const z = resized[index + 2];
    world[index] = elements[0] * x + elements[4] * y + elements[8] * z + elements[12];
    world[index + 1] = elements[1] * x + elements[5] * y + elements[9] * z + elements[13];
    world[index + 2] = elements[2] * x + elements[6] * y + elements[10] * z + elements[14];
  }
  return world;
}

const worldPositionsCache = new WeakMap<WorkplaneShape, number[]>();

/**
 * World-space triangle positions of an imported/baked mesh exactly as the
 * viewport and exporters place them (size scaling, mirror, rotation fields),
 * with the winding restored when an odd number of mirror flags is set.
 */
export function importedMeshWorldPositions(shape: WorkplaneShape) {
  if (!shape.importedMesh?.positions.length) return [];
  const cached = worldPositionsCache.get(shape);
  if (cached) return cached;
  const world = importedCoordinatesToWorld(shape, shape.importedMesh.positions);
  if (mirroredAxisCount(shape) % 2 === 1) {
    for (let index = 0; index + 8 < world.length; index += 9) {
      for (let axis = 0; axis < 3; axis += 1) {
        const second = world[index + 3 + axis];
        world[index + 3 + axis] = world[index + 6 + axis];
        world[index + 6 + axis] = second;
      }
    }
  }
  worldPositionsCache.set(shape, world);
  return world;
}

type ProjectionBounds = { min: THREE.Vector3; max: THREE.Vector3 };
const projectionBoundsCache = new WeakMap<WorkplaneShape, Map<string, ProjectionBounds>>();

/** Min/max of an imported mesh's world vertices projected onto three axes. */
export function importedMeshProjectionBounds(shape: WorkplaneShape, xAxis: THREE.Vector3, yAxis: THREE.Vector3, zAxis: THREE.Vector3): ProjectionBounds | null {
  if (!shape.importedMesh?.positions.length) return null;
  const axisKey = [...xAxis.toArray(), ...yAxis.toArray(), ...zAxis.toArray()].map((value) => value.toFixed(9)).join(":");
  let shapeCache = projectionBoundsCache.get(shape);
  if (!shapeCache) {
    shapeCache = new Map();
    projectionBoundsCache.set(shape, shapeCache);
  }
  const cached = shapeCache.get(axisKey);
  if (cached) return { min: cached.min.clone(), max: cached.max.clone() };

  // Stream the stored positions through (projection · placement) without
  // allocating a world-space copy: this runs for every selection frame.
  const mesh = shape.importedMesh;
  const preserve = preservesEdgeTreatmentSize(shape);
  const positions = preserve ? resizedImportedCoordinates(shape, mesh.positions) : mesh.positions;
  const scaleX = preserve ? 1 : shapeWidth(shape) / Math.max(0.001, mesh.baseWidth);
  const scaleY = preserve ? 1 : shape.height / Math.max(0.001, mesh.baseHeight);
  const scaleZ = preserve ? 1 : shapeDepth(shape) / Math.max(0.001, mesh.baseDepth);
  const e = shapeLocalToWorldMatrix(shape).elements;
  const row = (axis: THREE.Vector3) => [
    (axis.x * e[0] + axis.y * e[1] + axis.z * e[2]) * scaleX,
    (axis.x * e[4] + axis.y * e[5] + axis.z * e[6]) * scaleY,
    (axis.x * e[8] + axis.y * e[9] + axis.z * e[10]) * scaleZ,
    axis.x * e[12] + axis.y * e[13] + axis.z * e[14],
  ];
  const [ax, bx, cx, dx] = row(xAxis);
  const [ay, by, cy, dy] = row(yAxis);
  const [az, bz, cz, dz] = row(zAxis);
  const min = new THREE.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const max = new THREE.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  for (let index = 0; index + 2 < positions.length; index += 3) {
    const x = positions[index];
    const y = positions[index + 1];
    const z = positions[index + 2];
    const px = ax * x + bx * y + cx * z + dx;
    const py = ay * x + by * y + cy * z + dy;
    const pz = az * x + bz * y + cz * z + dz;
    if (px < min.x) min.x = px;
    if (py < min.y) min.y = py;
    if (pz < min.z) min.z = pz;
    if (px > max.x) max.x = px;
    if (py > max.y) max.y = py;
    if (pz > max.z) max.z = pz;
  }
  if (![min.x, min.y, min.z, max.x, max.y, max.z].every(Number.isFinite)) return null;
  shapeCache.set(axisKey, { min: min.clone(), max: max.clone() });
  return { min, max };
}

/** The extents of a shape (mesh vertices, or its analytic box) along three axes, in world units along each axis. */
export function shapeProjectionBounds(shape: WorkplaneShape, xAxis: THREE.Vector3, yAxis: THREE.Vector3, zAxis: THREE.Vector3): ProjectionBounds {
  const imported = importedMeshProjectionBounds(shape, xAxis, yAxis, zAxis);
  if (imported) return imported;
  const center = shapeCenter(shape);
  const quaternion = fieldRotationQuaternion(shape);
  const halfX = shapeWidth(shape) / 2;
  const halfY = shape.height / 2;
  const halfZ = shapeDepth(shape) / 2;
  const min = new THREE.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const max = new THREE.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  [-1, 1].forEach((xSign) => [-1, 1].forEach((ySign) => [-1, 1].forEach((zSign) => {
    const point = new THREE.Vector3(xSign * halfX, ySign * halfY, zSign * halfZ).applyQuaternion(quaternion).add(center);
    const projected = new THREE.Vector3(point.dot(xAxis), point.dot(yAxis), point.dot(zAxis));
    min.min(projected);
    max.max(projected);
  })));
  return { min, max };
}

/**
 * The selection frame a single shape gets when it is turned relative to the
 * reference axes: its own axes, hugging its true size. Null otherwise.
 */
export function shapeOwnFrame(shape: WorkplaneShape, reference: AxisTriple = WORLD_AXES): ShapeOwnFrame | null {
  const axes = shapeOwnFrameAxes(shape, reference);
  if (!axes) return null;
  const bounds = shapeProjectionBounds(shape, axes.xAxis, axes.yAxis, axes.zAxis);
  const localCenter = bounds.min.clone().add(bounds.max).multiplyScalar(0.5);
  const center = axes.xAxis.clone().multiplyScalar(localCenter.x)
    .addScaledVector(axes.yAxis, localCenter.y)
    .addScaledVector(axes.zAxis, localCenter.z);
  return {
    center,
    quaternion: axes.quaternion,
    xAxis: axes.xAxis,
    yAxis: axes.yAxis,
    zAxis: axes.zAxis,
    width: Math.max(MIN_FRAME_SIZE, bounds.max.x - bounds.min.x),
    height: Math.max(MIN_FRAME_SIZE, bounds.max.y - bounds.min.y),
    depth: Math.max(MIN_FRAME_SIZE, bounds.max.z - bounds.min.z),
  };
}

/** Whether resizing this shape along its own frame must rewrite its mesh (its positions are baked in world space with a recorded orientation). */
export function shapeNeedsOwnFrameMeshResize(shape: WorkplaneShape) {
  return Boolean(shape.importedMesh?.positions.length) && recordRotationMatrix(shape) !== null;
}

function frameBasis(frame: FrameBox) {
  return new THREE.Matrix4().makeBasis(frame.xAxis.clone().normalize(), frame.yAxis.clone().normalize(), frame.zAxis.clone().normalize());
}

/** The affine map that turns the frame box into the target box (same axes): T(c') · B · S · Bᵀ · T(-c). */
export function frameResizeMatrix(frame: FrameBox, target: { center: THREE.Vector3; width: number; height: number; depth: number }) {
  const basis = frameBasis(frame);
  const scale = new THREE.Matrix4().makeScale(
    target.width / Math.max(MIN_FRAME_SIZE, frame.width),
    target.height / Math.max(MIN_FRAME_SIZE, frame.height),
    target.depth / Math.max(MIN_FRAME_SIZE, frame.depth),
  );
  return new THREE.Matrix4()
    .makeTranslation(target.center.x, target.center.y, target.center.z)
    .multiply(basis)
    .multiply(scale)
    .multiply(basis.clone().transpose())
    .multiply(new THREE.Matrix4().makeTranslation(-frame.center.x, -frame.center.y, -frame.center.z));
}

/** Split an affine CAD transform into a rigid transform and per-axis scale when it has no shear. */
function rigidTransformAndScale(matrix: THREE.Matrix4) {
  const [x, y, z] = basisColumns(matrix);
  const scale = new THREE.Vector3(x.length(), y.length(), z.length());
  if (![scale.x, scale.y, scale.z].every((value) => value > 1e-12)) return null;
  const nx = x.clone().divideScalar(scale.x);
  const ny = y.clone().divideScalar(scale.y);
  const nz = z.clone().divideScalar(scale.z);
  if (Math.abs(nx.dot(ny)) > 1e-9 || Math.abs(nx.dot(nz)) > 1e-9 || Math.abs(ny.dot(nz)) > 1e-9) return null;
  const rigid = matrix.clone().multiply(new THREE.Matrix4().makeScale(1 / scale.x, 1 / scale.y, 1 / scale.z));
  return { rigid, scale };
}

type PointMap = (x: number, y: number, z: number, out: THREE.Vector3) => THREE.Vector3;

function affinePointMap(matrix: THREE.Matrix4): PointMap {
  return (x, y, z, out) => out.set(x, y, z).applyMatrix4(matrix);
}

function cleanTransform(matrix: THREE.Matrix4) {
  const transform = cadTransformFromMatrix(matrix);
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
  return transform.every((value, index) => Math.abs(value - identity[index]) < 1e-9) ? undefined : transform;
}

/**
 * Re-bake an imported/baked mesh after moving every world-space point through
 * `map` (an affine `matrix` when one exists). The result is a mesh in world
 * axes again, keeping the shape's orientation record, CAD frames, display
 * edges and edge-treatment history consistent with the new geometry.
 */
function rebakeImportedShape(shape: WorkplaneShape, map: PointMap, matrix: THREE.Matrix4 | null): Partial<WorkplaneShape> | null {
  const world = importedMeshWorldPositions(shape);
  if (world.length < 9) return null;
  const mapped = new Array<number>(world.length);
  const point = new THREE.Vector3();
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (let index = 0; index + 2 < world.length; index += 3) {
    map(world[index], world[index + 1], world[index + 2], point);
    mapped[index] = point.x;
    mapped[index + 1] = point.y;
    mapped[index + 2] = point.z;
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.z < minZ) minZ = point.z;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
    if (point.z > maxZ) maxZ = point.z;
  }
  if (![minX, minY, minZ, maxX, maxY, maxZ].every(Number.isFinite)) return null;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const width = Math.max(MIN_FRAME_SIZE, maxX - minX);
  const height = Math.max(MIN_FRAME_SIZE, maxY - minY);
  const depth = Math.max(MIN_FRAME_SIZE, maxZ - minZ);
  const positions = new Array<number>(mapped.length);
  for (let index = 0; index + 2 < mapped.length; index += 3) {
    positions[index] = mapped[index] - centerX;
    positions[index + 1] = mapped[index + 1] - minY;
    positions[index + 2] = mapped[index + 2] - centerZ;
  }
  const x = cleanNearZero(centerX, 0.0005);
  const z = cleanNearZero(centerZ, 0.0005);
  const elevation = cleanNearZero(minY, 0.0005);
  // CAD frames and display edges use the raw origin, as the editor's bake does.
  const newFrame = { x: centerX, z: centerZ, elevation: minY, width, depth, height };

  const cadDisplayEdges = shape.cadDisplayEdges?.flatMap((edge) => {
    const edgeWorld = importedCoordinatesToWorld(shape, edge.points);
    const points: number[] = [];
    for (let index = 0; index + 2 < edgeWorld.length; index += 3) {
      map(edgeWorld[index], edgeWorld[index + 1], edgeWorld[index + 2], point);
      points.push(point.x - centerX, point.y - minY, point.z - centerZ);
    }
    return points.length >= 6 && points.every(Number.isFinite) ? [{ points }] : [];
  });

  let cadPrimitiveFrame: WorkplaneShape["cadPrimitiveFrame"];
  const primitive = matrix ? cadModifierPrimitiveForBakedShape(shape) : null;
  if (primitive && matrix) {
    const transformed = matrix.clone().multiply(cadTransformToMatrix(primitive.transform));
    const split = rigidTransformAndScale(transformed);
    const sourceTransform = cleanTransform(split ? split.rigid : transformed);
    cadPrimitiveFrame = {
      kind: primitive.kind,
      width: split ? primitive.width * split.scale.x : primitive.width,
      depth: split ? primitive.depth * split.scale.z : primitive.depth,
      height: split ? primitive.height * split.scale.y : primitive.height,
      frame: { ...newFrame, ...(sourceTransform ? { sourceTransform } : {}) },
    };
  }

  let cadBrep: string | undefined;
  let cadBrepFrame: WorkplaneShape["cadBrepFrame"];
  if (matrix && shape.cadBrep && shape.cadBrepFrame) {
    const sourceTransform = cleanTransform(matrix.clone().multiply(cadTransformToMatrix(cadBrepTransformForShape(shape))));
    cadBrep = shape.cadBrep;
    cadBrepFrame = { ...newFrame, ...(sourceTransform ? { sourceTransform } : {}) };
  }

  const rebaked: Partial<WorkplaneShape> = {
    kind: "mesh",
    x,
    z,
    elevation,
    width,
    depth,
    height,
    size: Math.max(width, depth),
    rotation: 0,
    rotationX: 0,
    rotationZ: 0,
    mirrorX: undefined,
    mirrorY: undefined,
    mirrorZ: undefined,
    importedMesh: {
      positions,
      baseWidth: width,
      baseDepth: depth,
      baseHeight: height,
      triangleCount: Math.floor(positions.length / 9),
      sourceFormat: "json",
    },
    localFrame: orientationRecordForBake(shape),
    cadPrimitiveFrame,
    cadBrep,
    cadBrepFrame,
    cadDisplayEdges: cadDisplayEdges?.length ? cadDisplayEdges : undefined,
    cadDisplayEdgesVersion: cadDisplayEdges?.length ? 2 : undefined,
  };

  if (shape.edgeTreatmentHistory?.length) {
    const result = { ...shape, ...rebaked } as WorkplaneShape;
    rebaked.edgeTreatmentHistory = shape.edgeTreatmentHistory.map((entry) => {
      // Bring the pre-treatment snapshot to where it is now, then apply the
      // same deformation, so reverting the treatment later stays exact.
      const before = { ...restoreShapeBeforeEdgeTreatment(shape, entry), edgeTreatmentHistory: undefined };
      if (!before.importedMesh?.positions.length) return entry;
      const beforePatch = rebakeImportedShape(before, map, matrix);
      if (!beforePatch) return entry;
      return {
        ...entry,
        before: cloneWorkplaneShapeSnapshot({ ...before, ...beforePatch }),
        appliedFrame: edgeTreatmentAppliedFrame(result),
      };
    });
  }
  return rebaked;
}

/**
 * Resize a baked mesh along its own frame: the frame box becomes the target
 * box (same axes, new centre and size). Every vertex moves through the same
 * axis-aligned-in-the-frame scale, so a rotated box stays a box. Edge
 * treatments in "preserve" mode keep their size, as they do for world resizes.
 */
export function resizeShapeInOwnFrame(
  shape: WorkplaneShape,
  frame: FrameBox,
  target: { center: THREE.Vector3; width: number; height: number; depth: number },
): Partial<WorkplaneShape> | null {
  if (!shape.importedMesh?.positions.length) return null;
  const matrix = frameResizeMatrix(frame, target);
  const sizeChanged = Math.abs(target.width - frame.width) > 1e-9
    || Math.abs(target.height - frame.height) > 1e-9
    || Math.abs(target.depth - frame.depth) > 1e-9;
  if (!(preservesEdgeTreatmentSize(shape) && sizeChanged)) {
    return rebakeImportedShape(shape, affinePointMap(matrix), matrix);
  }

  const zone = edgeTreatmentPreserveZone(shape);
  const xAxis = frame.xAxis.clone().normalize();
  const yAxis = frame.yAxis.clone().normalize();
  const zAxis = frame.zAxis.clone().normalize();
  const offset = new THREE.Vector3();
  const preserveMap: PointMap = (x, y, z, out) => {
    offset.set(x - frame.center.x, y - frame.center.y, z - frame.center.z);
    const localX = edgePreservedCoordinate(offset.dot(xAxis), frame.width, target.width, true, zone);
    const localY = edgePreservedCoordinate(offset.dot(yAxis), frame.height, target.height, true, zone);
    const localZ = edgePreservedCoordinate(offset.dot(zAxis), frame.depth, target.depth, true, zone);
    return out.copy(target.center).addScaledVector(xAxis, localX).addScaledVector(yAxis, localY).addScaledVector(zAxis, localZ);
  };
  const patch = rebakeImportedShape(shape, preserveMap, null);
  // The exact B-Rep and primitive cannot follow a non-affine resize; the mesh
  // (and STL/STEP mesh export) carries the geometry instead.
  return patch ? { ...patch, cadBrep: undefined, cadBrepFrame: undefined, cadPrimitiveFrame: undefined } : null;
}

/**
 * Bake a shape's world-space mesh (as produced by the editor's mesh builder,
 * rotation and mirror already applied) into a world-axis mesh shape, keeping
 * the orientation it had in `localFrame`.
 */
export function bakeWorldMeshIntoShape(
  shape: WorkplaneShape,
  mesh: { vertices: Array<[number, number, number]>; faces: Array<[number, number, number]> },
  options: {
    cleanDimension: (value: number) => number;
    minDimension: number;
    bakeCadMetadata: (frame: { centerX: number; minY: number; centerZ: number; width: number; depth: number; height: number }) => Partial<WorkplaneShape>;
  },
): WorkplaneShape {
  if (mesh.vertices.length < 3 || mesh.faces.length < 1) return shape;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  mesh.vertices.forEach(([x, y, z]) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  });
  if (![minX, minY, minZ, maxX, maxY, maxZ].every(Number.isFinite)) return shape;

  const localFrame = orientationRecordForBake(shape);
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const rawWidth = Math.max(options.minDimension, maxX - minX);
  const rawHeight = Math.max(options.minDimension, maxY - minY);
  const rawDepth = Math.max(options.minDimension, maxZ - minZ);
  // A rotated shape is measured along its own axes, so its world bounds stay
  // exact: rounding them would rescale the mesh along world axes, a (tiny) shear.
  const width = localFrame ? rawWidth : options.cleanDimension(rawWidth);
  const height = localFrame ? rawHeight : options.cleanDimension(rawHeight);
  const depth = localFrame ? rawDepth : options.cleanDimension(rawDepth);
  const positions: number[] = [];
  const bakedCadMetadata = options.bakeCadMetadata({ centerX, minY, centerZ, width, depth, height });
  mesh.faces.forEach(([ai, bi, ci]) => {
    [mesh.vertices[ai], mesh.vertices[bi], mesh.vertices[ci]].forEach(([x, y, z]) => {
      positions.push(x - centerX, y - minY, z - centerZ);
    });
  });

  return {
    ...shape,
    kind: "mesh",
    x: cleanNearZero(centerX, 0.0005),
    z: cleanNearZero(centerZ, 0.0005),
    elevation: cleanNearZero(minY, 0.0005),
    width,
    depth,
    height,
    size: Math.max(width, depth),
    rotation: 0,
    rotationX: 0,
    rotationZ: 0,
    mirrorX: undefined,
    mirrorY: undefined,
    mirrorZ: undefined,
    importedMesh: {
      positions,
      baseWidth: rawWidth,
      baseDepth: rawDepth,
      baseHeight: rawHeight,
      triangleCount: mesh.faces.length,
      sourceFormat: "json",
    },
    ...bakedCadMetadata,
    localFrame,
    imagePlate: undefined,
    groupedShapes: undefined,
    groupedBaseWidth: undefined,
    groupedBaseDepth: undefined,
    groupedBaseHeight: undefined,
  };
}
