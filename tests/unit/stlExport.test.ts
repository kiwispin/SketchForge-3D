import { describe, expect, it } from "vitest";
import { stlHoleCount, stlSolidCount, stlSourceShapes } from "@/lib/stlExport";
import type { WorkplaneShape } from "@/types/sketchforge";

function shape(id: string, options: Partial<WorkplaneShape> = {}): WorkplaneShape {
  return {
    id,
    name: id,
    kind: "box",
    color: "#e44",
    x: 0,
    z: 0,
    size: 10,
    width: 10,
    depth: 10,
    height: 10,
    rotation: 0,
    ...options,
  };
}

describe("stl export scope", () => {
  it("uses the complete visible design by default even when a shape is selected", () => {
    const design = [shape("base"), shape("eye"), shape("hidden", { hidden: true })];
    const selected = [design[1]];

    expect(stlSourceShapes(design, selected)).toEqual([design[0], design[1]]);
  });

  it("supports an explicit selection-only export", () => {
    const design = [shape("base"), shape("eye")];

    expect(stlSourceShapes(design, [design[1]], "selection")).toEqual([design[1]]);
  });

  it("keeps holes in the preparation input so the boolean pass can apply them", () => {
    const source = [shape("solid"), shape("cut", { hole: true })];

    expect(stlSolidCount(source)).toBe(1);
    expect(stlHoleCount(source)).toBe(1);
  });
});
