import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { planeFromFace, placementPointOnPlane, planeBasisMatrix, planeWorldPoint, workplanePlane } from "@/lib/workplanePlanes";

describe("oriented workplanes", () => {
  it("keeps every preset basis right-handed", () => {
    (["ground", "top", "bottom", "front", "back", "right", "left"] as const).forEach((orientation) => {
      const plane = workplanePlane(orientation);
      const cross = plane.u.clone().cross(plane.v);
      expect(cross.distanceTo(plane.normal)).toBeLessThan(0.001);
      expect(planeBasisMatrix(plane).determinant()).toBeCloseTo(1, 5);
    });
  });

  it("labels planes by their actual coordinate axes", () => {
    expect(workplanePlane("ground").label).toContain("XZ");
    expect(workplanePlane("front").label).toContain("XY");
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

  it("builds a right-handed plane from an arbitrary selected face normal", () => {
    const plane = planeFromFace(new THREE.Vector3(2, 3, 4), new THREE.Vector3(1, 1, 0));
    expect(plane.orientation).toBe("face");
    expect(plane.normal.length()).toBeCloseTo(1);
    expect(plane.u.clone().cross(plane.v).distanceTo(plane.normal)).toBeLessThan(0.001);
    expect(planeBasisMatrix(plane).determinant()).toBeCloseTo(1, 5);
  });

  it("places a shape flush on a rotated box face along the face normal", () => {
    // A box rotated 30° about Y has its top-face world normal still (0,1,0),
    // but a side face points along the rotated X axis.
    const yaw = THREE.MathUtils.degToRad(30);
    const sideNormal = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
    const facePoint = new THREE.Vector3(4, 10, 6);
    const plane = planeFromFace(facePoint, sideNormal);
    expect(plane.normal.distanceTo(sideNormal)).toBeLessThan(0.001);

    // Placing an 8-high shape flush means its base sits on the face plane, so
    // the shape centre is facePoint + normal * (height / 2).
    const height = 8;
    const placement = placementPointOnPlane(plane, 0, 0, height);
    const centre = new THREE.Vector3(placement.x, placement.elevation + height / 2, placement.z);
    expect(centre.distanceTo(facePoint.clone().addScaledVector(sideNormal, height / 2))).toBeLessThan(0.001);
  });
});
