import { describe, expect, it } from "vitest";
import { checkPrintability } from "@/lib/printabilityPreflight";
import type { WorkplaneShape } from "@/types/sketchforge";

const workspace = { width: 200, depth: 200 };

function box(overrides: Partial<WorkplaneShape> = {}): WorkplaneShape {
  return {
    id: "box-1",
    name: "Box",
    kind: "box",
    color: "#d41721",
    x: 0,
    z: 0,
    elevation: 0,
    size: 20,
    width: 20,
    depth: 20,
    height: 20,
    rotation: 0,
    ...overrides,
  };
}

describe("printability preflight", () => {
  it("reports a clean solid as ready", () => {
    expect(checkPrintability([box()], workspace)).toEqual({ checkedCount: 1, issues: [] });
  });

  it("reports floating, undersized, and out-of-workspace shapes", () => {
    const report = checkPrintability([
      box({ id: "floating", name: "Floating box", elevation: 2 }),
      box({ id: "thin", name: "Thin box", height: 0.8 }),
      box({ id: "outside", name: "Outside box", x: 96 }),
    ], workspace);

    expect(report.checkedCount).toBe(3);
    expect(report.issues).toEqual([
      expect.objectContaining({ kind: "floating", shapeId: "floating" }),
      expect.objectContaining({ kind: "too-small", shapeId: "thin" }),
      expect.objectContaining({ kind: "outside-workspace", shapeId: "outside" }),
    ]);
  });

  it("does not warn when elevated shapes connect back to a grounded solid", () => {
    const report = checkPrintability([
      box({ id: "base", name: "Base", width: 40, depth: 40, size: 40, height: 20 }),
      box({ id: "sphere", name: "Sphere", kind: "sphere", width: 20, depth: 20, size: 20, height: 20, elevation: 20 }),
      box({ id: "top", name: "Top", width: 12, depth: 12, size: 12, height: 12, elevation: 40 }),
    ], workspace);

    expect(report.issues.filter((issue) => issue.kind === "floating")).toEqual([]);
  });

  it("reports one warning for a disconnected floating component", () => {
    const report = checkPrintability([
      box({ id: "base", name: "Base", height: 20 }),
      box({ id: "floating-a", name: "Floating A", x: 50, elevation: 30 }),
      box({ id: "floating-b", name: "Floating B", x: 50, elevation: 50 }),
    ], workspace);

    expect(report.issues.filter((issue) => issue.kind === "floating")).toEqual([
      expect.objectContaining({ shapeId: "floating-a", message: expect.stringContaining("2 connected shapes") }),
    ]);
  });

  it("keeps a real gap above a grounded solid as a floating warning", () => {
    const report = checkPrintability([
      box({ id: "base", name: "Base", height: 20 }),
      box({ id: "gap", name: "Gap", elevation: 20.2 }),
    ], workspace);

    expect(report.issues).toEqual([expect.objectContaining({ kind: "floating", shapeId: "gap" })]);
  });

  it("uses the rotated footprint, ignores holes, and checks hidden exported solids", () => {
    const report = checkPrintability([
      box({ id: "rotated", name: "Rotated box", width: 80, depth: 20, size: 80, x: 70, rotation: 45 }),
      box({ id: "hole", hole: true, elevation: 5, height: 0.5 }),
      box({ id: "hidden", hidden: true, elevation: 5, height: 0.5 }),
    ], workspace);

    expect(report.checkedCount).toBe(2);
    expect(report.issues).toEqual([
      expect.objectContaining({ kind: "outside-workspace", shapeId: "rotated" }),
      expect.objectContaining({ kind: "too-small", shapeId: "hidden" }),
      expect.objectContaining({ kind: "floating", shapeId: "hidden" }),
    ]);
  });
});
