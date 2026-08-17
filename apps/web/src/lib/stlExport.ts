import type { WorkplaneShape } from "@/types/sketchforge";

export type StlExportScope = "design" | "selection";

/**
 * STL is the print-oriented export, so its safe default is the complete
 * visible design. Selection-only export is still supported as an explicit
 * choice from the export panel.
 */
export function stlSourceShapes(
  shapes: WorkplaneShape[],
  selectedShapes: WorkplaneShape[],
  scope: StlExportScope = "design",
): WorkplaneShape[] {
  const candidates = scope === "selection" ? selectedShapes : shapes;
  return candidates.filter((shape) => !shape.hidden);
}

export function stlSolidCount(shapes: WorkplaneShape[]) {
  return shapes.filter((shape) => !shape.hole).length;
}

export function stlHoleCount(shapes: WorkplaneShape[]) {
  return shapes.filter((shape) => Boolean(shape.hole)).length;
}
