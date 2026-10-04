import * as THREE from "three";
import { cadTransformToMatrix } from "@/lib/cadBakeMetadata";
import type { WorkplaneShape } from "@/types/sketchforge";

export type DuplicateRepeatPattern = {
  selectedIds: string[];
  sourceShapes: WorkplaneShape[];
};

export function duplicateRepeatMatches(pattern: DuplicateRepeatPattern | null, selectedIds: string[]) {
  return Boolean(
    pattern &&
    pattern.selectedIds.length === selectedIds.length &&
    pattern.selectedIds.every((id, index) => id === selectedIds[index]),
  );
}

type RotationDegrees = {
  rotationX: number;
  rotation: number;
  rotationZ: number;
};

/**
 * The rotation a shape currently displays. A shape that was rotated and then
 * baked has its rotation folded into its geometry (`rotation` reads 0), but the
 * bake records the original transform in `cadPrimitiveFrame.frame.sourceTransform`.
 * Recovering it here keeps a duplicate-repeat from misreading rotation as scale.
 */
export function displayedRotationDegrees(shape: WorkplaneShape): RotationDegrees {
  const frameRotation = bakedRotationDegrees(shape);
  return {
    rotationX: frameRotation.rotationX + (shape.rotationX ?? 0),
    rotation: frameRotation.rotation + (shape.rotation ?? 0),
    rotationZ: frameRotation.rotationZ + (shape.rotationZ ?? 0),
  };
}

function bakedRotationDegrees(shape: WorkplaneShape): RotationDegrees {
  const sourceTransform = shape.cadPrimitiveFrame?.frame?.sourceTransform;
  if (sourceTransform && sourceTransform.length === 12 && sourceTransform.every(Number.isFinite)) {
    const matrix = cadTransformToMatrix(sourceTransform);
    const euler = new THREE.Euler().setFromRotationMatrix(matrix);
    return {
      rotationX: THREE.MathUtils.radToDeg(euler.x),
      rotation: THREE.MathUtils.radToDeg(euler.y),
      rotationZ: THREE.MathUtils.radToDeg(euler.z),
    };
  }
  return { rotationX: 0, rotation: 0, rotationZ: 0 };
}

/**
 * The source primitive's own dimensions, before any rotation was baked into an
 * axis-aligned bounding box. Scale deltas must be measured against these, or a
 * pure rotation would be misread as growth.
 */
function trueDimensions(shape: WorkplaneShape) {
  const primitive = shape.cadPrimitiveFrame;
  if (primitive && Number.isFinite(primitive.width) && Number.isFinite(primitive.depth) && Number.isFinite(primitive.height)) {
    return { width: primitive.width, depth: primitive.depth, height: primitive.height };
  }
  return { width: shape.width, depth: shape.depth, height: shape.height };
}

/**
 * Apply the complete transform delta from a duplicate's source to its current
 * shape. Position, lift, rotation and scale deltas are all replayed; rotation
 * and scale are measured against the displayed (pre-bake) transform so a
 * baked rotation repeats as rotation rather than growing the mesh.
 */
export function repeatShapeTransform(current: WorkplaneShape, source: WorkplaneShape): WorkplaneShape {
  const currentDims = trueDimensions(current);
  const sourceDims = trueDimensions(source);
  const widthRatio = sourceDims.width > 0 ? currentDims.width / sourceDims.width : 1;
  const depthRatio = sourceDims.depth > 0 ? currentDims.depth / sourceDims.depth : 1;
  const heightRatio = sourceDims.height > 0 ? currentDims.height / sourceDims.height : 1;
  const currentRotation = displayedRotationDegrees(current);
  const sourceRotation = displayedRotationDegrees(source);
  const width = Math.max(0.01, (shapeWidth(current) ?? current.width) * widthRatio);
  const depth = Math.max(0.01, (shapeDepth(current) ?? current.depth) * depthRatio);
  const height = Math.max(0.01, current.height * heightRatio);
  return {
    ...current,
    x: current.x + (current.x - source.x),
    z: current.z + (current.z - source.z),
    elevation: (current.elevation ?? 0) + ((current.elevation ?? 0) - (source.elevation ?? 0)),
    width,
    depth,
    height,
    size: Math.max(width, depth),
    rotation: cleanRotationDelta((current.rotation ?? 0) + (currentRotation.rotation - sourceRotation.rotation)),
    rotationX: cleanRotationDelta((current.rotationX ?? 0) + (currentRotation.rotationX - sourceRotation.rotationX)),
    rotationZ: cleanRotationDelta((current.rotationZ ?? 0) + (currentRotation.rotationZ - sourceRotation.rotationZ)),
    baseRadius: current.baseRadius === undefined ? current.baseRadius : width / 2,
  };
}

function shapeWidth(shape: WorkplaneShape) {
  return shape.width ?? shape.size ?? 1;
}

function shapeDepth(shape: WorkplaneShape) {
  return shape.depth ?? shape.size ?? 1;
}

function cleanRotationDelta(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return Math.abs(normalized) < 0.001 ? 0 : Number(normalized.toFixed(3));
}
