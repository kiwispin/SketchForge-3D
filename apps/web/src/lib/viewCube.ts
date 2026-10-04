import * as THREE from "three";

export type ViewCubeFace = "top" | "bottom" | "front" | "back" | "right" | "left";

const POLE_OFFSET_RADIANS = THREE.MathUtils.degToRad(0.01);

export function viewFaceDirection(face: ViewCubeFace) {
  const direction: Record<ViewCubeFace, [number, number, number]> = {
    top: [0, 1, 0],
    bottom: [0, -1, 0],
    front: [0, 0, 1],
    back: [0, 0, -1],
    right: [1, 0, 0],
    left: [-1, 0, 0],
  };
  return new THREE.Vector3(...direction[face]);
}

export function viewFaceOrbitPose(face: ViewCubeFace) {
  const direction = viewFaceDirection(face);
  if (face === "top" || face === "bottom") {
    const verticalDirection = face === "top" ? 1 : -1;
    direction.set(
      0,
      verticalDirection * Math.cos(POLE_OFFSET_RADIANS),
      Math.sin(POLE_OFFSET_RADIANS),
    );
  }
  return {
    direction,
    up: new THREE.Vector3(0, 1, 0),
  };
}

/** Front-aligned Home pose with enough elevation to keep the workplane visible. */
export function frontAlignedHomePosition(elevation = 96, horizontalDistance = Math.hypot(118, 118)) {
  const position = viewFaceDirection("front").multiplyScalar(horizontalDistance);
  position.y = elevation;
  return position;
}
