import * as THREE from "three";

export type ViewCubeFace = "top" | "bottom" | "front" | "back" | "right" | "left";

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

export function viewFaceUp(face: ViewCubeFace) {
  if (face === "top") return new THREE.Vector3(0, 0, -1);
  if (face === "bottom") return new THREE.Vector3(0, 0, 1);
  return new THREE.Vector3(0, 1, 0);
}

/** Front-aligned Home pose with enough elevation to keep the workplane visible. */
export function frontAlignedHomePosition(elevation = 96, horizontalDistance = Math.hypot(118, 118)) {
  const position = viewFaceDirection("front").multiplyScalar(horizontalDistance);
  position.y = elevation;
  return position;
}
