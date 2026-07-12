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

function footprintHalfExtents(shape: WorkplaneShape) {
  const halfWidth = shapeWidth(shape) / 2;
  const halfDepth = shapeDepth(shape) / 2;
  const angle = Math.abs((shape.rotation * Math.PI) / 180);
  const cosine = Math.abs(Math.cos(angle));
  const sine = Math.abs(Math.sin(angle));
  return {
    x: halfWidth * cosine + halfDepth * sine,
    z: halfWidth * sine + halfDepth * cosine,
  };
}

export function checkPrintability(shapes: WorkplaneShape[], workspace: Pick<WorkplaneWorkspaceSettings, "width" | "depth">): PrintabilityReport {
  const solids = shapes.filter((shape) => !shape.hole);
  const issues: PrintabilityIssue[] = [];

  solids.forEach((shape) => {
    const dimensions = [shapeWidth(shape), shapeDepth(shape), shape.height];
    if (dimensions.some((dimension) => dimension < MIN_PRINTABLE_DIMENSION_MM)) {
      issues.push({
        kind: "too-small",
        shapeId: shape.id,
        shapeName: shape.name,
        message: `${shape.name} has a dimension under ${MIN_PRINTABLE_DIMENSION_MM} mm`,
      });
    }

    if ((shape.elevation ?? 0) > WORKPLANE_TOLERANCE_MM) {
      issues.push({
        kind: "floating",
        shapeId: shape.id,
        shapeName: shape.name,
        message: `${shape.name} is ${Number((shape.elevation ?? 0).toFixed(2))} mm above the workplane`,
      });
    }

    const footprint = footprintHalfExtents(shape);
    if (
      shape.x - footprint.x < -workspace.width / 2 - WORKPLANE_TOLERANCE_MM ||
      shape.x + footprint.x > workspace.width / 2 + WORKPLANE_TOLERANCE_MM ||
      shape.z - footprint.z < -workspace.depth / 2 - WORKPLANE_TOLERANCE_MM ||
      shape.z + footprint.z > workspace.depth / 2 + WORKPLANE_TOLERANCE_MM
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
