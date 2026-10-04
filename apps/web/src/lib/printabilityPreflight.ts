import * as THREE from "three";
import { shapeDepth, shapeWidth } from "@/lib/workplaneShapes";
import type { WorkplaneShape, WorkplaneWorkspaceSettings } from "@/types/sketchforge";

export type PrintabilityIssueKind = "floating" | "too-small" | "outside-workspace";

export type PrintabilityIssue = {
  kind: PrintabilityIssueKind;
  shapeId: string;
  shapeName: string;
  message: string;
};

export type PrintabilityReport = {
  checkedCount: number;
  issues: PrintabilityIssue[];
};

const MIN_PRINTABLE_DIMENSION_MM = 1;
const WORKPLANE_TOLERANCE_MM = 0.01;
const CONNECTION_TOLERANCE_MM = 0.05;

type WorldBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

function worldBounds(shape: WorkplaneShape): WorldBounds {
  const halfWidth = shapeWidth(shape) / 2;
  const halfHeight = shape.height / 2;
  const halfDepth = shapeDepth(shape) / 2;
  const center = new THREE.Vector3(shape.x, (shape.elevation ?? 0) + halfHeight, shape.z);
  const rotation = new THREE.Matrix4().makeRotationFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(shape.rotationX ?? 0),
      THREE.MathUtils.degToRad(shape.rotation ?? 0),
      THREE.MathUtils.degToRad(shape.rotationZ ?? 0),
      "XYZ",
    ),
  );
  const bounds: WorldBounds = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
  };
  for (const x of [-halfWidth, halfWidth]) {
    for (const y of [-halfHeight, halfHeight]) {
      for (const z of [-halfDepth, halfDepth]) {
        const point = new THREE.Vector3(x, y, z).applyMatrix4(rotation).add(center);
        bounds.minX = Math.min(bounds.minX, point.x);
        bounds.maxX = Math.max(bounds.maxX, point.x);
        bounds.minY = Math.min(bounds.minY, point.y);
        bounds.maxY = Math.max(bounds.maxY, point.y);
        bounds.minZ = Math.min(bounds.minZ, point.z);
        bounds.maxZ = Math.max(bounds.maxZ, point.z);
      }
    }
  }
  return bounds;
}

function boundsGap(aMin: number, aMax: number, bMin: number, bMax: number) {
  if (aMax < bMin) return bMin - aMax;
  if (bMax < aMin) return aMin - bMax;
  return 0;
}

function boundsConnect(a: WorldBounds, b: WorldBounds) {
  return (
    boundsGap(a.minX, a.maxX, b.minX, b.maxX) <= CONNECTION_TOLERANCE_MM &&
    boundsGap(a.minY, a.maxY, b.minY, b.maxY) <= CONNECTION_TOLERANCE_MM &&
    boundsGap(a.minZ, a.maxZ, b.minZ, b.maxZ) <= CONNECTION_TOLERANCE_MM
  );
}

function floatingComponentIssues(solids: WorkplaneShape[], bounds: WorldBounds[]) {
  const connections = solids.map(() => new Set<number>());
  for (let index = 0; index < solids.length; index += 1) {
    for (let candidate = index + 1; candidate < solids.length; candidate += 1) {
      if (boundsConnect(bounds[index], bounds[candidate])) {
        connections[index].add(candidate);
        connections[candidate].add(index);
      }
    }
  }

  const visited = new Set<number>();
  const issues = new Map<string, PrintabilityIssue>();
  solids.forEach((shape, startIndex) => {
    if (visited.has(startIndex)) return;
    const component: number[] = [];
    const queue = [startIndex];
    visited.add(startIndex);
    while (queue.length) {
      const index = queue.pop()!;
      component.push(index);
      connections[index].forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }

    const grounded = component.some((index) => bounds[index].minY <= WORKPLANE_TOLERANCE_MM);
    if (grounded) return;

    const representative = component[0];
    const lowestPoint = Math.min(...component.map((index) => bounds[index].minY));
    const names = component.map((index) => solids[index].name);
    const label = component.length === 1 ? names[0] : `${component.length} connected shapes (${names.join(", ")})`;
    issues.set(solids[representative].id, {
      kind: "floating",
      shapeId: solids[representative].id,
      shapeName: label,
      message: component.length === 1
        ? `${label} is a disconnected component ${Number(lowestPoint.toFixed(2))} mm above the workplane`
        : `${label} form a disconnected component ${Number(lowestPoint.toFixed(2))} mm above the workplane`,
    });
  });
  return issues;
}

export function checkPrintability(shapes: WorkplaneShape[], workspace: Pick<WorkplaneWorkspaceSettings, "width" | "depth">): PrintabilityReport {
  const solids = shapes.filter((shape) => !shape.hole);
  const bounds = solids.map(worldBounds);
  const floatingIssues = floatingComponentIssues(solids, bounds);
  const issues: PrintabilityIssue[] = [];

  solids.forEach((shape, index) => {
    const dimensions = [shapeWidth(shape), shapeDepth(shape), shape.height];
    if (dimensions.some((dimension) => dimension < MIN_PRINTABLE_DIMENSION_MM)) {
      issues.push({
        kind: "too-small",
        shapeId: shape.id,
        shapeName: shape.name,
        message: `${shape.name} has a dimension under ${MIN_PRINTABLE_DIMENSION_MM} mm`,
      });
    }

    const floatingIssue = floatingIssues.get(shape.id);
    if (floatingIssue) issues.push(floatingIssue);

    const footprint = bounds[index];
    if (
      footprint.minX < -workspace.width / 2 - WORKPLANE_TOLERANCE_MM ||
      footprint.maxX > workspace.width / 2 + WORKPLANE_TOLERANCE_MM ||
      footprint.minZ < -workspace.depth / 2 - WORKPLANE_TOLERANCE_MM ||
      footprint.maxZ > workspace.depth / 2 + WORKPLANE_TOLERANCE_MM
    ) {
      issues.push({
        kind: "outside-workspace",
        shapeId: shape.id,
        shapeName: shape.name,
        message: `${shape.name} extends outside the workplane`,
      });
    }
  });

  return { checkedCount: solids.length, issues };
}
