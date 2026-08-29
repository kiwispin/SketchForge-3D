export type GizmoWorldVector = { x: number; y: number; z: number };
export type GizmoScreenPoint = { x: number; y: number };

export type VerticalPresentationFace = "z-max" | "x-max" | "z-min" | "x-min";

export type RotationPresentationState = {
  selectionId: string;
  face: VerticalPresentationFace;
  yawRadians: number;
  direction: -1 | 0 | 1;
};

export const ROTATION_FACE_HANDOFF_DEGREES = 5;
export const LOWER_ROTATION_GLYPH_GAP_PX = 52;
export const UPPER_ROTATION_GLYPH_GAP_PX = 34;

const FACE_ORDER: readonly VerticalPresentationFace[] = ["z-max", "x-max", "z-min", "x-min"];

function wrapRadians(value: number) {
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return value;
}

function faceIndex(face: VerticalPresentationFace) {
  return FACE_ORDER.indexOf(face);
}

function faceYaw(face: VerticalPresentationFace) {
  return faceIndex(face) * Math.PI / 2;
}

function adjacentFace(face: VerticalPresentationFace, direction: -1 | 1) {
  const index = (faceIndex(face) + direction + FACE_ORDER.length) % FACE_ORDER.length;
  return FACE_ORDER[index];
}

export function cameraYawInSelectionFrame(
  cameraOffset: GizmoWorldVector,
  frameXAxis: GizmoWorldVector,
  frameZAxis: GizmoWorldVector,
) {
  const localX = cameraOffset.x * frameXAxis.x + cameraOffset.y * frameXAxis.y + cameraOffset.z * frameXAxis.z;
  const localZ = cameraOffset.x * frameZAxis.x + cameraOffset.y * frameZAxis.y + cameraOffset.z * frameZAxis.z;
  return Math.atan2(localX, localZ);
}

export function nearestPresentationFace(yawRadians: number): VerticalPresentationFace {
  const quarterTurn = Math.PI / 2;
  const index = Math.round(wrapRadians(yawRadians) / quarterTurn);
  return FACE_ORDER[(index + FACE_ORDER.length) % FACE_ORDER.length];
}

/** Places the workplane protractor at the selection's lower world level. */
export function lowerWorkplaneProtractorPivot(min: GizmoWorldVector, max: GizmoWorldVector): GizmoWorldVector {
  return {
    x: (min.x + max.x) / 2,
    y: min.y,
    z: (min.z + max.z) / 2,
  };
}

export function createRotationPresentationState(selectionId: string, yawRadians: number): RotationPresentationState {
  return {
    selectionId,
    face: nearestPresentationFace(yawRadians),
    yawRadians,
    direction: 0,
  };
}

/**
 * Tinkercad does not visibly slide a compact rotation control around a corner.
 * It hides the control during the active camera gesture and hands its
 * presentation to the next vertical face shortly after leaving a cardinal
 * view. This state machine records that discrete handoff; the caller owns the
 * visible/hidden lifecycle.
 */
export function updateRotationPresentationState(
  current: RotationPresentationState | null,
  selectionId: string,
  yawRadians: number,
  handoffDegrees = ROTATION_FACE_HANDOFF_DEGREES,
): RotationPresentationState {
  if (!current || current.selectionId !== selectionId) {
    return createRotationPresentationState(selectionId, yawRadians);
  }

  const delta = wrapRadians(yawRadians - current.yawRadians);
  const direction: -1 | 0 | 1 = Math.abs(delta) < 0.00001 ? current.direction : delta > 0 ? 1 : -1;
  if (direction === 0) {
    return { ...current, yawRadians };
  }

  const threshold = handoffDegrees * Math.PI / 180;
  let face = current.face;
  // A large scripted camera jump can cross more than one face in one update.
  // Iterate with a strict cap so the state remains deterministic.
  for (let index = 0; index < FACE_ORDER.length; index += 1) {
    const relative = wrapRadians(yawRadians - faceYaw(face));
    const shouldAdvance = direction > 0 ? relative >= threshold : relative <= -threshold;
    if (!shouldAdvance) break;
    face = adjacentFace(face, direction);
  }

  return { selectionId, face, yawRadians, direction };
}

export function lowerRotationFaceAnchor(
  face: VerticalPresentationFace,
  bounds: { min: GizmoWorldVector; max: GizmoWorldVector },
) {
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerZ = (bounds.min.z + bounds.max.z) / 2;
  if (face === "z-max") {
    return { point: { x: centerX, y: bounds.min.y, z: bounds.max.z }, outward: { x: 0, y: 0, z: 1 } };
  }
  if (face === "x-max") {
    return { point: { x: bounds.max.x, y: bounds.min.y, z: centerZ }, outward: { x: 1, y: 0, z: 0 } };
  }
  if (face === "z-min") {
    return { point: { x: centerX, y: bounds.min.y, z: bounds.min.z }, outward: { x: 0, y: 0, z: -1 } };
  }
  return { point: { x: bounds.min.x, y: bounds.min.y, z: centerZ }, outward: { x: -1, y: 0, z: 0 } };
}

export function upperRotationFaceAnchor(
  axis: "x" | "z",
  cameraInSelectionFrame: GizmoWorldVector,
  bounds: { min: GizmoWorldVector; max: GizmoWorldVector },
) {
  const centerX = (bounds.min.x + bounds.max.x) / 2;
  const centerZ = (bounds.min.z + bounds.max.z) / 2;
  if (axis === "x") {
    const sign = cameraInSelectionFrame.x >= 0 ? 1 : -1;
    return {
      point: { x: sign > 0 ? bounds.max.x : bounds.min.x, y: bounds.max.y, z: centerZ },
      outward: { x: sign, y: 0.72, z: 0 },
      face: sign > 0 ? "x-max" as const : "x-min" as const,
    };
  }
  const sign = cameraInSelectionFrame.z >= 0 ? 1 : -1;
  return {
    point: { x: centerX, y: bounds.max.y, z: sign > 0 ? bounds.max.z : bounds.min.z },
    outward: { x: 0, y: 0.72, z: sign },
    face: sign > 0 ? "z-max" as const : "z-min" as const,
  };
}

export function projectedRotationGlyphMatrix(
  projectedTangent: GizmoScreenPoint,
  projectedOutward: GizmoScreenPoint,
  minimumOutwardRatio = 0.6,
): [number, number, number, number] {
  const tangentLength = Math.max(0.0001, Math.hypot(projectedTangent.x, projectedTangent.y));
  const tangentX = projectedTangent.x / tangentLength;
  const tangentY = projectedTangent.y / tangentLength;
  let outwardX = projectedOutward.x / tangentLength;
  let outwardY = projectedOutward.y / tangentLength;
  const outwardLength = Math.hypot(outwardX, outwardY);
  if (outwardLength < minimumOutwardRatio) {
    const sign = tangentX * outwardY - tangentY * outwardX >= 0 ? 1 : -1;
    outwardX = -tangentY * minimumOutwardRatio * sign;
    outwardY = tangentX * minimumOutwardRatio * sign;
  }
  return [tangentX, tangentY, outwardX, outwardY];
}

export function rotationPlaneFacing(cameraOffset: GizmoWorldVector, axis: "x" | "z") {
  const length = Math.max(0.0001, Math.hypot(cameraOffset.x, cameraOffset.y, cameraOffset.z));
  return Math.abs((axis === "x" ? cameraOffset.x : cameraOffset.z) / length);
}

export function upperRotationScreenSlots(
  selectionCenter: GizmoScreenPoint,
  topCenter: GizmoScreenPoint,
  xFaceAnchor: GizmoScreenPoint,
  zFaceAnchor: GizmoScreenPoint,
  rise = UPPER_ROTATION_GLYPH_GAP_PX,
  separation = 31,
) {
  let upX = topCenter.x - selectionCenter.x;
  let upY = topCenter.y - selectionCenter.y;
  let upLength = Math.hypot(upX, upY);
  if (upLength < 0.5) {
    upX = 0;
    upY = -1;
    upLength = 1;
  }
  upX /= upLength;
  upY /= upLength;
  const rightX = -upY;
  const rightY = upX;
  const base = { x: topCenter.x + upX * rise, y: topCenter.y + upY * rise };
  const side = (anchor: GizmoScreenPoint) => (anchor.x - topCenter.x) * rightX + (anchor.y - topCenter.y) * rightY;
  let xSign = side(xFaceAnchor) >= 0 ? 1 : -1;
  let zSign = side(zFaceAnchor) >= 0 ? 1 : -1;
  if (xSign === zSign) {
    xSign = 1;
    zSign = -1;
  }
  return {
    x: { x: base.x + rightX * separation * xSign, y: base.y + rightY * separation * xSign },
    z: { x: base.x + rightX * separation * zSign, y: base.y + rightY * separation * zSign },
  };
}

export function placeRigidRotationGlyph(
  faceAnchor: GizmoScreenPoint,
  projectedOutward: GizmoScreenPoint,
  projectedSelectionCenter: GizmoScreenPoint,
  gap = LOWER_ROTATION_GLYPH_GAP_PX,
) {
  let dx = projectedOutward.x - faceAnchor.x;
  let dy = projectedOutward.y - faceAnchor.y;
  let length = Math.hypot(dx, dy);
  if (length < 0.5) {
    dx = faceAnchor.x - projectedSelectionCenter.x;
    dy = faceAnchor.y - projectedSelectionCenter.y;
    length = Math.hypot(dx, dy);
  }
  if (length < 0.5) {
    dx = 0;
    dy = 1;
    length = 1;
  }
  return {
    x: faceAnchor.x + dx / length * gap,
    y: faceAnchor.y + dy / length * gap,
  };
}

/** The canonical glyph opens toward screen-up. */
export function rotationGlyphAngleTowardFace(glyphCenter: GizmoScreenPoint, faceAnchor: GizmoScreenPoint) {
  const targetRadians = Math.atan2(faceAnchor.y - glyphCenter.y, faceAnchor.x - glyphCenter.x);
  const degrees = targetRadians * 180 / Math.PI + 90;
  return ((degrees + 180) % 360 + 360) % 360 - 180;
}

export function rotationControlsHidden(cameraInteractionActive: boolean) {
  return cameraInteractionActive;
}
