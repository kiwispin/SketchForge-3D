import type { PointerEvent as ReactPointerEvent } from "react";

export type TransformHandleKind = "scale" | "height" | "lift" | "move" | "rotate";
export type RotationAxis = "x" | "y" | "z";
export type RotationWheelView = {
  x: number;
  y: number;
  radius: number;
  /** Optional affine projection of the unit circle into the selected world plane. */
  matrix?: [number, number, number, number];
  /** Screen-space zero direction expressed in the wheel's local circle coordinates. */
  zeroRadians?: number;
};

export type RotationHandleView = {
  key: string;
  axis: RotationAxis;
  className: string;
  x: number;
  y: number;
  angle: number;
  editX: number;
  editY: number;
};

export type PinnedRotationWheelView = {
  axis: RotationAxis;
  wheel: RotationWheelView;
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
  onHoverRotationHandle: (axis: RotationAxis) => void;
  onLeaveRotationHandle: () => void;
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
export const ROTATION_PROTRACTOR_RADIUS = 168;

/**
 * The fallback wheel is a fixed screen-space guide centred on the actual
 * selection pivot. Axis-specific wheels use projectedRotationWheel below so
 * the guide can show the selected world plane without inheriting the model's
 * dimensions.
 */
export function screenRotationWheel(center: { x: number; y: number }, viewport: { width: number; height: number }): RotationWheelView {
  const maximumRadius = Math.max(42, Math.min(viewport.width, viewport.height) / 2 - 24);
  return {
    x: center.x,
    y: center.y,
    radius: Math.min(ROTATION_PROTRACTOR_RADIUS, maximumRadius),
  };
}

export function projectedRotationWheel(
  center: { x: number; y: number },
  firstAxis: { x: number; y: number },
  secondAxis: { x: number; y: number },
  zeroVector: { x: number; y: number },
  viewport: { width: number; height: number },
): RotationWheelView {
  const firstLength = Math.hypot(firstAxis.x, firstAxis.y);
  const secondLength = Math.hypot(secondAxis.x, secondAxis.y);
  const majorLength = Math.max(firstLength, secondLength, 0.0001);
  const wheel = screenRotationWheel(center, viewport);
  const determinant = firstAxis.x * secondAxis.y - secondAxis.x * firstAxis.y;
  let zeroRadians = -Math.PI / 2;
  if (Math.abs(determinant) > 0.0001) {
    const firstCoefficient = (zeroVector.x * secondAxis.y - zeroVector.y * secondAxis.x) / determinant;
    const secondCoefficient = (firstAxis.x * zeroVector.y - firstAxis.y * zeroVector.x) / determinant;
    if (Math.hypot(firstCoefficient, secondCoefficient) > 0.0001) {
      zeroRadians = Math.atan2(secondCoefficient, firstCoefficient);
    }
  }
  return {
    ...wheel,
    matrix: [
      firstAxis.x / majorLength,
      firstAxis.y / majorLength,
      secondAxis.x / majorLength,
      secondAxis.y / majorLength,
    ],
    zeroRadians,
  };
}

export function rotationWheelPoint(wheel: RotationWheelView, angleDegrees: number, radius = wheel.radius): { x: number; y: number } {
  const radians = (wheel.zeroRadians ?? -Math.PI / 2) + angleDegrees * Math.PI / 180;
  const localX = Math.cos(radians) * radius;
  const localY = Math.sin(radians) * radius;
  const matrix = wheel.matrix;
  if (!matrix) {
    return { x: wheel.x + localX, y: wheel.y + localY };
  }
  return {
    x: wheel.x + matrix[0] * localX + matrix[2] * localY,
    y: wheel.y + matrix[1] * localX + matrix[3] * localY,
  };
}

/**
 * Converts a screen-space point back into the wheel's local projected plane
 * and returns its local radial distance. This keeps coarse/fine snapping on
 * the annular band correct when the plane is foreshortened by the camera.
 */
export function rotationWheelLocalRadius(wheel: RotationWheelView, point: { x: number; y: number }) {
  const deltaX = point.x - wheel.x;
  const deltaY = point.y - wheel.y;
  const matrix = wheel.matrix;
  if (!matrix) {
    return Math.hypot(deltaX, deltaY);
  }
  const determinant = matrix[0] * matrix[3] - matrix[2] * matrix[1];
  if (Math.abs(determinant) < 0.0001) {
    return Math.hypot(deltaX, deltaY);
  }
  const localX = (deltaX * matrix[3] - deltaY * matrix[2]) / determinant;
  const localY = (matrix[0] * deltaY - matrix[1] * deltaX) / determinant;
  return Math.hypot(localX, localY);
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
