import * as THREE from "three";

export type WorkplaneOrientation = "ground" | "top" | "bottom" | "front" | "back" | "right" | "left";

export type WorkplanePlane = {
  orientation: WorkplaneOrientation;
  label: string;
  origin: THREE.Vector3;
  normal: THREE.Vector3;
  u: THREE.Vector3;
  v: THREE.Vector3;
  rotationX: number;
  rotationZ: number;
};

type PlaneBasis = {
  label: string;
  normal: [number, number, number];
  u: [number, number, number];
  v: [number, number, number];
  rotationX: number;
  rotationZ: number;
};

const PLANE_BASES: Record<WorkplaneOrientation, PlaneBasis> = {
  ground: { label: "Ground (XY)", normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], rotationX: 0, rotationZ: 0 },
  top: { label: "Top face (XY)", normal: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], rotationX: 0, rotationZ: 0 },
  bottom: { label: "Bottom face (XY)", normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], rotationX: 180, rotationZ: 0 },
  front: { label: "Front face (XZ)", normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], rotationX: 90, rotationZ: 0 },
  back: { label: "Back face (XZ)", normal: [0, 0, -1], u: [1, 0, 0], v: [0, -1, 0], rotationX: -90, rotationZ: 0 },
  right: { label: "Right face (YZ)", normal: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], rotationX: 0, rotationZ: -90 },
  left: { label: "Left face (YZ)", normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], rotationX: 0, rotationZ: 90 },
};

export function workplanePlane(orientation: WorkplaneOrientation, origin = new THREE.Vector3()): WorkplanePlane {
  const basis = PLANE_BASES[orientation];
  return {
    orientation,
    label: basis.label,
    origin: origin.clone(),
    normal: new THREE.Vector3(...basis.normal),
    u: new THREE.Vector3(...basis.u),
    v: new THREE.Vector3(...basis.v),
    rotationX: basis.rotationX,
    rotationZ: basis.rotationZ,
  };
}
export function planeFromFace(orientation: Exclude<WorkplaneOrientation, "ground">, origin: THREE.Vector3) {
  return workplanePlane(orientation, origin);
}

export function planeWorldPoint(plane: WorkplanePlane, u: number, v: number, normalOffset = 0) {
  return plane.origin.clone()
    .addScaledVector(plane.u, u)
    .addScaledVector(plane.v, v)
    .addScaledVector(plane.normal, normalOffset);
}

export function planeBasisMatrix(plane: WorkplanePlane) {
  return new THREE.Matrix4().makeBasis(plane.u, plane.v, plane.normal);
}

export function placementPointOnPlane(plane: WorkplanePlane, u: number, v: number, height: number) {
  const center = planeWorldPoint(plane, u, v, height / 2);
  return {
    x: center.x,
    z: center.z,
    elevation: center.y - height / 2,
    rotationX: plane.rotationX,
    rotationZ: plane.rotationZ,
  };
}
