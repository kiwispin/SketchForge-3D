import type { PointerEvent as ReactPointerEvent } from "react";

export type TransformHandleKind = "scale" | "height" | "lift" | "move" | "rotate";
export type RotationAxis = "x" | "y" | "z";
export type RotationWheelView = { x: number; y: number; radius: number };

export type RotationPlaneView = {
  x: number;
  y: number;
  a: number;
  b: number;
  c: number;
  d: number;
};

export type RotationArcPoint = {
  x: number;
  y: number;
};

export type RotationArcView = {
  points: RotationArcPoint[];
  arrow: [RotationArcPoint, RotationArcPoint, RotationArcPoint];
};

export type RotationHandleView = {
  key: string;
  axis: RotationAxis;
  className: string;
  x: number;
  y: number;
  angle: number;
  arc: RotationArcView;
  editX: number;
  editY: number;
};

export type PinnedRotationWheelView = {
  axis: RotationAxis;
  wheel: RotationWheelView;
  plane: RotationPlaneView;
};

export type DimensionMark = {
  key: string;
  handleKey: string;
  axis: "width" | "depth" | "height" | "elevation";
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  e1x1: number;
  e1y1: number;
  e1x2: number;
  e1y2: number;
  e2x1: number;
  e2y1: number;
  e2x2: number;
  e2y2: number;
  labelX: number;
  labelY: number;
};

export type TransformOverlayState = {
  id: string;
  width: number;
  height: number;
  guides: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  handles: Array<{ key: string; className: string; kind: TransformHandleKind; x: number; y: number; title: string; angle?: number }>;
  rotateHandles: RotationHandleView[];
  dimensions: Record<string, DimensionMark[]>;
  rotationWheel: RotationWheelView | null;
  rotationWheels: Record<RotationAxis, RotationWheelView>;
  rotationPlaneCenters: Record<RotationAxis, { x: number; y: number; z: number }>;
  rotationPlanes: Record<RotationAxis, RotationPlaneView>;
};

export type RotationReadout = {
  x: number;
  y: number;
  text: string;
  angle?: number;
} | null;

export type EditingDimension = {
  key: string;
  axis: "width" | "depth" | "height" | "elevation";
  x: number;
  y: number;
  value: string;
} | null;

export type EditingRotation = {
  axis: RotationAxis;
  handleKey: string;
  x: number;
  y: number;
  value: string;
} | null;

export type TransformOverlayProps = {
  box: TransformOverlayState;
  measureKey: string | null;
  editingDimension: EditingDimension;
  editingRotation: EditingRotation;
  rotationReadout: RotationReadout;
  showRotationWheel: boolean;
  hideSelectionChrome: boolean;
  hideDimensionMarks: boolean;
  rotationWheelAxis: RotationAxis;
  pinnedRotationWheelView: PinnedRotationWheelView | null;
  onBeginTransform: (kind: TransformHandleKind, handleKey: string, event: ReactPointerEvent<Element>) => void;
  onMoveTransform: (clientX: number, clientY: number, shiftKey?: boolean, altKey?: boolean) => boolean;
  onFinishTransform: (event: ReactPointerEvent<Element>) => void;
  onHoverMeasure: (key: string | null) => void;
  onPinMeasure: (key: string | null) => void;
  onBeginDimensionEdit: (mark: DimensionMark) => void;
  onBeginLiftEdit: (handleKey: string, x: number, y: number) => void;
  onEditingDimensionChange: (value: string) => void;
  onCommitDimensionEdit: () => void;
  onCancelDimensionEdit: () => void;
  onBeginRotationEdit: (handleKey: string, x: number, y: number) => void;
  onEditingRotationChange: (value: string) => void;
  onCommitRotationEdit: () => void;
  onCancelRotationEdit: () => void;
};

export function getElevationMeasureKey(overlay: TransformOverlayState | null) {
  return (
    Object.values(overlay?.dimensions ?? {})
      .flat()
      .find((mark) => mark.axis === "elevation")?.handleKey ?? null
  );
}

export function measureKeyForHandle(kind: TransformHandleKind, handleKey: string, overlay: TransformOverlayState | null) {
  if (kind === "lift") {
    return getElevationMeasureKey(overlay) ?? handleKey;
  }
  return handleKey;
}

export const MIN_LIFT_HANDLE_SCREEN_GAP = 32;
export const MOVE_HANDLE_SCREEN_OFFSET = 36;
export const ROTATION_ARC_RADIUS = 22;
export const ROTATION_ARC_SWEEP_DEGREES = 86;

function projectRotationPlanePoint(plane: RotationPlaneView, x: number, y: number): RotationArcPoint {
  return {
    x: plane.x + plane.a * x + plane.c * y,
    y: plane.y + plane.b * x + plane.d * y,
  };
}

/**
 * Builds a curved rotation arrow in the same projected plane used by the
 * rotation protractor. The target chooses which outward-facing part of the
 * ellipse is shown, while the plane matrix makes the curve follow the camera.
 */
export function projectedRotationArc(
  plane: RotationPlaneView,
  target: RotationArcPoint,
  radius = ROTATION_ARC_RADIUS,
  sweepDegrees = ROTATION_ARC_SWEEP_DEGREES,
): RotationArcView {
  const screenX = target.x - plane.x;
  const screenY = target.y - plane.y;
  const determinant = plane.a * plane.d - plane.b * plane.c;
  let localX: number;
  let localY: number;
  if (Math.abs(determinant) > 0.00001) {
    localX = (plane.d * screenX - plane.c * screenY) / determinant;
    localY = (-plane.b * screenX + plane.a * screenY) / determinant;
  } else {
    // An axis viewed nearly edge-on collapses one direction of the projected
    // plane. The transpose still picks the closest visible outward direction.
    localX = plane.a * screenX + plane.b * screenY;
    localY = plane.c * screenX + plane.d * screenY;
  }
  const localLength = Math.hypot(localX, localY);
  if (localLength < 0.00001) {
    localX = 0;
    localY = 1;
  }
  const outwardAngle = Math.atan2(localY, localX);
  const halfSweep = (sweepDegrees * Math.PI) / 360;
  const steps = 18;
  const rawPoints = Array.from({ length: steps + 1 }, (_, index) => {
    const angle = outwardAngle - halfSweep + (2 * halfSweep * index) / steps;
    return projectRotationPlanePoint(plane, Math.cos(angle) * radius, Math.sin(angle) * radius);
  });
  // The plane controls the arrow's shape, while the target is the deliberately
  // clear screen-space location just outside the selected object's bounds.
  const arcMiddle = rawPoints[Math.floor(rawPoints.length / 2)];
  const offsetX = target.x - arcMiddle.x;
  const offsetY = target.y - arcMiddle.y;
  const points = rawPoints.map((point) => ({ x: point.x + offsetX, y: point.y + offsetY }));
  const tip = points[points.length - 1];
  const previous = points[points.length - 2];
  const tangentX = tip.x - previous.x;
  const tangentY = tip.y - previous.y;
  const tangentLength = Math.max(0.00001, Math.hypot(tangentX, tangentY));
  const unitX = tangentX / tangentLength;
  const unitY = tangentY / tangentLength;
  const arrowLength = 7;
  const arrowHalfWidth = 3.25;
  const baseX = tip.x - unitX * arrowLength;
  const baseY = tip.y - unitY * arrowLength;
  const normalX = -unitY;
  const normalY = unitX;
  return {
    points,
    arrow: [
      tip,
      { x: baseX + normalX * arrowHalfWidth, y: baseY + normalY * arrowHalfWidth },
      { x: baseX - normalX * arrowHalfWidth, y: baseY - normalY * arrowHalfWidth },
    ],
  };
}

export function projectedMoveHandle(
  origin: { x: number; y: number },
  projectedAxisPoint: { x: number; y: number },
  fallbackAngle: number,
  offset = MOVE_HANDLE_SCREEN_OFFSET,
) {
  const deltaX = projectedAxisPoint.x - origin.x;
  const deltaY = projectedAxisPoint.y - origin.y;
  const distance = Math.hypot(deltaX, deltaY);
  const angle = distance > 0.5 ? Math.atan2(deltaY, deltaX) : fallbackAngle;
  return {
    x: origin.x + Math.cos(angle) * offset,
    y: origin.y + Math.sin(angle) * offset,
    angle: angle * 180 / Math.PI,
  };
}

export function separatedLiftHandlePoint(
  heightPoint: { x: number; y: number },
  projectedLiftPoint: { x: number; y: number },
  lower: boolean,
  minimumGap = MIN_LIFT_HANDLE_SCREEN_GAP,
) {
  const deltaX = projectedLiftPoint.x - heightPoint.x;
  const deltaY = projectedLiftPoint.y - heightPoint.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance >= minimumGap) {
    return projectedLiftPoint;
  }
  const direction = distance > 0.5
    ? { x: deltaX / distance, y: deltaY / distance }
    : { x: 0, y: lower ? 1 : -1 };
  return {
    x: heightPoint.x + direction.x * minimumGap,
    y: heightPoint.y + direction.y * minimumGap,
  };
}
