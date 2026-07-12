import { describe, expect, it } from "vitest";
import { computeTutorialSignals, getTutorial, tutorials } from "@/lib/tutorials";
import type { WorkplaneShape } from "@/types/sketchforge";

function shape(overrides: Partial<WorkplaneShape> = {}): WorkplaneShape {
  return {
    id: overrides.id ?? "s1",
    name: "Box",
    kind: "box",
    color: "#d41721",
    x: 0,
    z: 0,
    size: 20,
    width: 20,
    depth: 20,
    height: 20,
    rotation: 0,
    ...overrides,
  };
}

describe("computeTutorialSignals", () => {
  it("reports zeros for an empty scene", () => {
    expect(computeTutorialSignals([])).toEqual({
      shapeCount: 0,
      solidCount: 0,
      holeCount: 0,
      groupCount: 0,
      rotatedCount: 0,
      dimensionFingerprint: 0,
    });
  });

  it("counts solids and the dimension fingerprint", () => {
    const s = computeTutorialSignals([shape()]);
    expect(s.shapeCount).toBe(1);
    expect(s.solidCount).toBe(1);
    expect(s.holeCount).toBe(0);
    expect(s.dimensionFingerprint).toBe(60); // 20 + 20 + 20
  });

  it("separates holes from solids", () => {
    const s = computeTutorialSignals([shape({ id: "a" }), shape({ id: "b", hole: true })]);
    expect(s.solidCount).toBe(1);
    expect(s.holeCount).toBe(1);
  });

  it("counts a shape as rotated for any nonzero rotation axis", () => {
    expect(computeTutorialSignals([shape({ rotation: 30 })]).rotatedCount).toBe(1);
    expect(computeTutorialSignals([shape({ rotationX: 15 })]).rotatedCount).toBe(1);
    expect(computeTutorialSignals([shape({ rotationZ: -45 })]).rotatedCount).toBe(1);
    expect(computeTutorialSignals([shape()]).rotatedCount).toBe(0);
  });

  it("counts grouped shapes only when they contain children", () => {
    const grouped = shape({ id: "g", groupedShapes: [shape({ id: "c1" }), shape({ id: "c2" })] });
    expect(computeTutorialSignals([grouped]).groupCount).toBe(1);
    expect(computeTutorialSignals([shape({ groupedShapes: [] })]).groupCount).toBe(0);
  });
});

describe("learn-the-basics step checks", () => {
  const tutorial = getTutorial("learn-the-basics");
  const byId = (id: string) => tutorial!.steps.find((step) => step.id === id)!;

  it("exists and has a valid structure", () => {
    expect(tutorial).not.toBeNull();
    const ids = tutorial!.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length); // unique ids
    expect(tutorial!.steps.length).toBeGreaterThanOrEqual(5);
    expect(tutorials.length).toBeGreaterThanOrEqual(1);
  });

  it("intro and outro steps are manual (no check)", () => {
    expect(byId("welcome").check).toBeUndefined();
    expect(byId("done").check).toBeUndefined();
  });

  it("place advances when a shape is added, not before", () => {
    const start = computeTutorialSignals([]);
    expect(byId("place").check!(computeTutorialSignals([]), start)).toBe(false);
    expect(byId("place").check!(computeTutorialSignals([shape()]), start)).toBe(true);
  });

  it("resize advances when a dimension changes", () => {
    const base = [shape()];
    const start = computeTutorialSignals(base);
    expect(byId("resize").check!(computeTutorialSignals(base), start)).toBe(false);
    expect(byId("resize").check!(computeTutorialSignals([shape({ width: 40 })]), start)).toBe(true);
  });

  it("rotate advances only once a shape is rotated", () => {
    const base = [shape()];
    const start = computeTutorialSignals(base);
    expect(byId("rotate").check!(computeTutorialSignals(base), start)).toBe(false);
    expect(byId("rotate").check!(computeTutorialSignals([shape({ rotation: 30 })]), start)).toBe(true);
  });

  it("hole advances when a hole appears", () => {
    const base = [shape()];
    const start = computeTutorialSignals(base);
    expect(byId("hole").check!(computeTutorialSignals(base), start)).toBe(false);
    expect(byId("hole").check!(computeTutorialSignals([shape(), shape({ id: "h", hole: true })]), start)).toBe(true);
  });

  it("group advances when a grouped shape appears", () => {
    const base = [shape(), shape({ id: "h", hole: true })];
    const start = computeTutorialSignals(base);
    expect(byId("group").check!(computeTutorialSignals(base), start)).toBe(false);
    const grouped = [shape({ id: "g", groupedShapes: [shape(), shape({ id: "h", hole: true })] })];
    expect(byId("group").check!(computeTutorialSignals(grouped), start)).toBe(true);
  });
});
