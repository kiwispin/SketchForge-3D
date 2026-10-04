import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { placementPatchForNewShape, placementWorkplaneFromSurface } from "@/lib/placementWorkplane";

// Ported from the fork's workplanePlanes test (b3db047): the fork's own
// oriented-workplane module is superseded by upstream's placementWorkplane,
// so the "flush on a rotated face" check now runs against upstream's module.
describe("placement on a rotated face", () => {
  it("places a shape flush on a rotated box side face along the face normal", () => {
    // A box rotated 30 degrees about Y has a side face pointing along its rotated X axis.
    const yaw = THREE.MathUtils.degToRad(30);
    const sideNormal = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)).normalize();
    const facePoint = { x: 4, y: 10, z: 6 };
    const workplane = placementWorkplaneFromSurface(facePoint, { x: sideNormal.x, y: sideNormal.y, z: sideNormal.z }, { x: 0, y: 1, z: 0 });
    expect(new THREE.Vector3(workplane.normal.x, workplane.normal.y, workplane.normal.z).distanceTo(sideNormal)).toBeLessThan(0.001);

    // Flush placement puts the shape centre at facePoint + normal * (height / 2).
    const height = 8;
    const patch = placementPatchForNewShape({ height }, workplane);
    const centre = new THREE.Vector3(patch.x, patch.elevation + height / 2, patch.z);
    const expected = new THREE.Vector3(facePoint.x, facePoint.y, facePoint.z).addScaledVector(sideNormal, height / 2);
    expect(centre.distanceTo(expected)).toBeLessThan(0.001);
  });
});
