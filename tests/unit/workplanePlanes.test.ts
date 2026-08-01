import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { placementPointOnPlane, planeBasisMatrix, planeWorldPoint, workplanePlane } from "@/lib/workplanePlanes";

describe("oriented workplanes", () => {
  it("keeps every preset basis right-handed", () => {
    (["ground", "top", "bottom", "front", "back", "right", "left"] as const).forEach((orientation) => {
      const plane = workplanePlane(orientation);
      const cross = plane.u.clone().cross(plane.v);
      expect(cross.distanceTo(plane.normal)).toBeLessThan(0.001);
      expect(planeBasisMatrix(plane).determinant()).toBeCloseTo(1, 5);
    });
  });

  it("maps local workplane coordinates onto a vertical face", () => {
    const plane = workplanePlane("front", new THREE.Vector3(0, 10, 20));
    expect(planeWorldPoint(plane, 4, 6)).toEqual(new THREE.Vector3(4, 16, 20));
    expect(placementPointOnPlane(plane, 4, 6, 8)).toMatchObject({ x: 4, z: 24, elevation: 12, rotationX: 90, rotationZ: 0 });
  });

  it("maps right and bottom workplanes with the correct outward direction", () => {
    const right = workplanePlane("right", new THREE.Vector3(20, 0, 0));
    const bottom = workplanePlane("bottom", new THREE.Vector3(0, 0, 0));
    expect(placementPointOnPlane(right, 3, 5, 4)).toMatchObject({ x: 22, z: -3, elevation: 3, rotationZ: -90 });
    expect(placementPointOnPlane(bottom, 3, 5, 4)).toMatchObject({ x: 3, z: 5, elevation: -4, rotationX: 180 });
  });
});
