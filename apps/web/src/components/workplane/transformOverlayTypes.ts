import type { PointerEvent as ReactPointerEvent } from "react";

export type TransformHandleKind = "scale" | "height" | "lift" | "move" | "rotate";
export type RotationAxis = "x" | "y" | "z";
export type WorldVec3 = { x: number; y: number; z: number };
export type ScreenVec2 = { x: number; y: number };

/**
 * One shared source of truth for a rotation control. Rendering (the projected
 * protractor) and dragging (the ray-plane angle) both consume this descriptor,
 * so the displayed plane, the drag direction and the resulting quaternion can
 * never disagree — even for an already-rotated object.
 *
 * Axes use world-plane identity: "x" means rotation around the world X axis,
 * in the plane spanned by world Y and world Z. This is what Tinkercad-style
 * handles should mean regardless of the object's own orientation.
 */
export type RotationPlaneDescriptor = {
  axis: RotationAxis;
  /** World-space unit rotation axis (e.g. (1,0,0) for the X handle). */
  axisVector: WorldVec3;
  /** World-space unit basis spanning the rotation plane (in-plane). */
  planeU: WorldVec3;
  /** World-space unit basis spanning the rotation plane (in-plane). */
  planeV: WorldVec3;
  /** World-space pivot the selection rotates around. */
  pivot: WorldVec3;
  /** Projected pivot on screen. */
  screenCenter: ScreenVec2;
  /** Screen-space projection of planeU relative to screenCenter. */
  screenU: ScreenVec2;
  /** Screen-space projection of planeV relative to screenCenter. */
  screenV: ScreenVec2;
  /** World-space point the handle anchors to (an extreme frame corner). */
  handleWorldAnchor: WorldVec3;
  /** Screen position of the handle button. */
  handleAnchor: ScreenVec2;
  /** The protractor view (fixed screen radius, affine plane projection). */
  wheel: RotationWheelView;
};

export const WORLD_ROTATION_PLANES: Record<RotationAxis, { axisVector: WorldVec3; planeU: WorldVec3; planeV: WorldVec3 }> = {
  x: { axisVector: { x: 1, y: 0, z: 0 }, planeU: { x: 0, y: 1, z: 0 }, planeV: { x: 0, y: 0, z: 1 } },
  y: { axisVector: { x: 0, y: 1, z: 0 }, planeU: { x: 1, y: 0, z: 0 }, planeV: { x: 0, y: 0, z: 1 } },
  z: { axisVector: { x: 0, y: 0, z: 1 }, planeU: { x: 1, y: 0, z: 0 }, planeV: { x: 0, y: 1, z: 0 } },
};

function addWorldVec3(a: WorldVec3, b: WorldVec3): WorldVec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

function subtractScreenVec2(a: ScreenVec2, b: ScreenVec2): ScreenVec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function buildRotationPlaneDescriptor(
  axis: RotationAxis,
  pivot: WorldVec3,
  project: (point: WorldVec3) => ScreenVec2,
  handleAnchor: ScreenVec2,
  handleWorldAnchor: WorldVec3,
  viewport: { width: number; height: number },
): RotationPlaneDescriptor {
  const plane = WORLD_ROTATION_PLANES[axis];
  const screenCenter = project(pivot);
  const screenU = subtractScreenVec2(project(addWorldVec3(pivot, plane.planeU)), screenCenter);
  const screenV = subtractScreenVec2(project(addWorldVec3(pivot, plane.planeV)), screenCenter);
  const wheel = projectedRotationWheel(screenCenter, screenU, screenV, subtractScreenVec2(handleAnchor, screenCenter), viewport);
  return {
    axis,
    axisVector: { ...plane.axisVector },
    planeU: { ...plane.planeU },
    planeV: { ...plane.planeV },
    pivot: { ...pivot },
    screenCenter,
    screenU,
    screenV,
    handleWorldAnchor: { ...handleWorldAnchor },
    handleAnchor,
    wheel,
  };
}

export function unwrapRadians(value: number) {
  if (value > Math.PI) {
    return value - Math.PI * 2;
  }
  if (value < -Math.PI) {
    return value + Math.PI * 2;
  }
  return value;
}

function dotWorldVec3(a: WorldVec3, b: WorldVec3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function crossWorldVec3(a: WorldVec3, b: WorldVec3): WorldVec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalizeWorldVec3(value: WorldVec3): WorldVec3 {
  const length = Math.hypot(value.x, value.y, value.z);
  if (length < 0.0000001) {
    return { x: 0, y: 0, z: 0 };
  }
  return { x: value.x / length, y: value.y / length, z: value.z / length };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Signed angle (radians) from `start` to `current` measured around `axis` in
 * the shared world rotation plane. Consumed by the drag path so the resulting
 * quaternion matches the plane the protractor renders.
 */
export function signedAngleAroundAxis(start: WorldVec3, current: WorldVec3, axis: WorldVec3) {
  const a = normalizeWorldVec3(start);
  const b = normalizeWorldVec3(current);
  const ax = normalizeWorldVec3(axis);
  const cross = crossWorldVec3(a, b);
  return Math.atan2(dotWorldVec3(ax, cross), clamp(dotWorldVec3(a, b), -1, 1));
}
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
  rotationPlanes: Record<RotationAxis, RotationPlaneDescriptor>;
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
  activeRotationAxis: RotationAxis | null;
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

function worldVec3Axis(value: WorldVec3, axis: RotationAxis) {
  return axis === "x" ? value.x : axis === "y" ? value.y : value.z;
}

/**
 * Semantic anchor for one rotation handle, assigned by world-plane identity:
 * the X handle anchors the centre of the frame face whose normal is world X
 * (toward the camera), Y the +Y face centre, Z the +Z face centre. This keeps
 * the three handles on distinct frame faces and cannot reorient with a
 * pre-rotated object.
 *
 * `previous` provides hysteresis on the camera-facing side: the chosen face
 * only flips when the camera has clearly crossed the pivot plane, so handles
 * do not swap during small camera movements or orbit jitter.
 */
export function worldPlaneHandleAnchor(
  axis: RotationAxis,
  corners: WorldVec3[],
  center: WorldVec3,
  cameraPosition: WorldVec3,
  previous: WorldVec3 | null,
): WorldVec3 {
  const worldMin = axis === "x" ? Math.min(...corners.map((c) => c.x)) : axis === "y" ? Math.min(...corners.map((c) => c.y)) : Math.min(...corners.map((c) => c.z));
  const worldMax = axis === "x" ? Math.max(...corners.map((c) => c.x)) : axis === "y" ? Math.max(...corners.map((c) => c.y)) : Math.max(...corners.map((c) => c.z));
  const extent = Math.max(1e-6, worldMax - worldMin);
  const cameraOffset = worldVec3Axis(cameraPosition, axis) - worldVec3Axis(center, axis);
  const candidateSide = cameraOffset >= 0 ? 1 : -1;
  let side = candidateSide;
  if (previous) {
    const previousSide = worldVec3Axis(previous, axis) >= worldVec3Axis(center, axis) ? 1 : -1;
    if (previousSide !== candidateSide && Math.abs(cameraOffset) < extent * 0.35) {
      side = previousSide;
    }
  }
  const coordinate = side > 0 ? worldMax : worldMin;
  if (axis === "x") return { x: coordinate, y: center.y, z: center.z };
  if (axis === "y") return { x: center.x, y: coordinate, z: center.z };
  return { x: center.x, y: center.y, z: coordinate };
}

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

export function orthographicFitZoom(viewport: { width: number; height: number }, spanX: number, spanY: number, padding = 1.28) {
  return Math.min(
    viewport.width / Math.max(0.0001, spanX * padding),
    viewport.height / Math.max(0.0001, spanY * padding),
  );
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

export function rotationSnapDelta(rawDegrees: number, radialDistance: number, wheelRadius: number, shiftKey = false) {
  if (shiftKey) {
    return Math.round(rawDegrees / 45) * 45;
  }
  if (Number.isFinite(wheelRadius) && radialDistance <= wheelRadius) {
    return Math.round(rawDegrees / 22.5) * 22.5;
  }
  return Math.round(rawDegrees);
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

export type TransformFeedbackKind = "move" | "resize" | "height" | "lift" | "rotate";

/**
 * One structured feedback model for every transform gesture. Every kind uses
 * the same label vocabulary and unit formatting, so move/resize/height/lift
 * report deltas consistently and rotation reports degrees.
 */
export type TransformFeedback = {
  kind: TransformFeedbackKind;
  /** "ΔW · ΔD · ΔH", "ΔX", "45°", etc. */
  text: string;
};

export function formatDeltaText(value: number, label: string, digits = 2) {
  const magnitude = Math.abs(value) < 0.0000001 ? 0 : value;
  return `Δ${label} ${magnitude.toFixed(digits)}`;
}

export function formatAngleText(degrees: number) {
  const value = Math.abs(degrees) < 0.0000001 ? 0 : Number(degrees.toFixed(1));
  return `${value}°`;
}

/**
 * Places a transform feedback label a fixed screen offset from an anchor so it
 * never sits on top of the handle being dragged and stays within the viewport.
 */
export function feedbackScreenPoint(
  anchor: { x: number; y: number },
  viewport: { width: number; height: number },
  offsetX = 22,
  offsetY = -30,
) {
  const labelWidth = 132;
  const labelHeight = 26;
  return {
    x: clamp(anchor.x + offsetX, labelWidth / 2 + 6, viewport.width - labelWidth / 2 - 6),
    y: clamp(anchor.y + offsetY, labelHeight / 2 + 6, viewport.height - labelHeight / 2 - 6),
  };
}
