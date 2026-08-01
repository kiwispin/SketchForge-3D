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

/** Apply the complete transform delta from a duplicate's source to its current shape. */
export function repeatShapeTransform(current: WorkplaneShape, source: WorkplaneShape): WorkplaneShape {
  const widthRatio = source.width > 0 ? current.width / source.width : 1;
  const depthRatio = source.depth > 0 ? current.depth / source.depth : 1;
  const heightRatio = source.height > 0 ? current.height / source.height : 1;
  const width = Math.max(0.01, current.width * widthRatio);
  const depth = Math.max(0.01, current.depth * depthRatio);
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
    rotation: current.rotation + (current.rotation - source.rotation),
    rotationX: (current.rotationX ?? 0) + ((current.rotationX ?? 0) - (source.rotationX ?? 0)),
    rotationZ: (current.rotationZ ?? 0) + ((current.rotationZ ?? 0) - (source.rotationZ ?? 0)),
    baseRadius: current.baseRadius === undefined ? current.baseRadius : width / 2,
  };
}
