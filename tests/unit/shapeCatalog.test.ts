import { describe, expect, it } from "vitest";
import type { ShapeAsset, WorkplaneShape } from "@/types/sketchforge";
import { automaticShapePlacement, connectorShapeAssets, makeShapeFromAsset, printablePartShapeAssets, sceneShape, shapeLibraryCategories, toolbarShapeAssets } from "@/lib/shapeCatalog";

const workspace = { width: 200, depth: 200 };

function placedBox(overrides: Partial<WorkplaneShape> = {}): WorkplaneShape {
  return {
    id: "existing-box",
    name: "Existing box",
    kind: "box",
    color: "#d41721",
    x: 0,
    z: 0,
    elevation: 0,
    size: 80,
    width: 80,
    depth: 80,
    height: 20,
    rotation: 0,
    locked: false,
    hidden: false,
    ...overrides,
  };
}

describe("shape catalog", () => {
  it("uses the centre for automatic placement when it is clear", () => {
    const box = toolbarShapeAssets.find((asset) => asset.id === "box")!;
    expect(automaticShapePlacement(box, [], workspace)).toEqual({ x: 0, z: 0, elevation: 0 });
  });

  it("finds a nearby clear placement instead of putting a new shape inside a centre object", () => {
    const box = toolbarShapeAssets.find((asset) => asset.id === "box")!;
    const placement = automaticShapePlacement(box, [placedBox()], workspace)!;
    expect(placement).not.toMatchObject({ x: 0, z: 0 });
    expect(Math.abs(placement.x) >= 52 || Math.abs(placement.z) >= 52).toBe(true);
  });

  it("allows centre placement when an existing object is above the current workplane", () => {
    const box = toolbarShapeAssets.find((asset) => asset.id === "box")!;
    expect(automaticShapePlacement(box, [placedBox({ elevation: 30 })], workspace)).toEqual({ x: 0, z: 0, elevation: 0 });
  });

  it("does not expose removed decorative shapes in the toolbar catalog", () => {
    const kinds = toolbarShapeAssets.map((asset) => asset.kind);

    expect(kinds).not.toContain("star");
    expect(kinds).not.toContain("heart");
  });

  it("keeps text in its own library category while preserving the basic shapes", () => {
    const basic = shapeLibraryCategories.find((category) => category.id === "basic");
    const text = shapeLibraryCategories.find((category) => category.id === "text");

    expect(basic?.shapes.map((asset) => asset.kind)).toContain("box");
    expect(basic?.shapes.map((asset) => asset.kind)).not.toContain("text");
    expect(text?.shapes).toHaveLength(1);
    expect(text?.shapes[0]).toMatchObject({ id: "text", kind: "text", name: "Text" });
  });

  it("uses distinct coloured icons for basic shapes and a real hole icon for the Socket", () => {
    const basic = shapeLibraryCategories.find((category) => category.id === "basic")!;
    const socket = connectorShapeAssets.find((asset) => asset.id === "connector-socket")!;

    expect(new Set(basic.shapes.map((shape) => shape.color)).size).toBe(basic.shapes.length);
    expect(basic.shapes.every((shape) => shape.menuIcon.startsWith("assets/sketchforge/") && !shape.menuIcon.includes("shape-icons-gray"))).toBe(true);
    expect(socket.menuIcon).toBe("assets/sketchforge/cylinder-hole.png");
  });

  it("offers a classroom connector pair with compatible peg and socket dimensions", () => {
    const connectors = shapeLibraryCategories.find((category) => category.id === "connectors");
    const peg = connectorShapeAssets.find((asset) => asset.id === "connector-peg");
    const socket = connectorShapeAssets.find((asset) => asset.id === "connector-socket");

    expect(connectors?.shapes.map((asset) => asset.id)).toEqual(["connector-peg", "connector-socket"]);
    expect(peg).toBeDefined();
    expect(socket).toBeDefined();
    expect(makeShapeFromAsset(peg!)).toMatchObject({ name: "Peg", kind: "cylinder", width: 8, depth: 8, height: 16, hole: undefined, sides: 48 });
    expect(makeShapeFromAsset(socket!)).toMatchObject({ name: "Socket", kind: "cylinder", width: 10, depth: 10, height: 12, hole: true, sides: 48 });
  });

  it("offers editable printable-part starters with purposeful dimensions", () => {
    const printableParts = shapeLibraryCategories.find((category) => category.id === "printableParts");
    const byId = (id: string) => printablePartShapeAssets.find((asset) => asset.id === id)!;

    expect(printableParts?.shapes.map((asset) => asset.id)).toEqual([
      "printable-name-tag",
      "printable-phone-stand",
      "printable-cable-guide",
      "printable-spacer",
    ]);
    expect(printableParts?.shapes.map((asset) => asset.menuIcon)).toEqual([
      "assets/sketchforge/printable-name-tag.svg",
      "assets/sketchforge/printable-phone-stand.svg",
      "assets/sketchforge/printable-cable-guide.svg",
      "assets/sketchforge/printable-spacer.svg",
    ]);
    const nameTag = makeShapeFromAsset(byId("printable-name-tag"));
    expect(nameTag).toMatchObject({ kind: "box", width: 70, depth: 28, height: 5, groupedBaseWidth: 70, groupedBaseDepth: 28, groupedBaseHeight: 5 });
    expect(nameTag.groupedShapes?.map((shape) => shape.name)).toEqual(["Name tag plaque", "Keyring hole", "NAME label"]);
    expect(nameTag.groupedShapes?.[1]).toMatchObject({ kind: "cylinder", hole: true, width: 6, height: 5, elevation: 0 });
    expect(nameTag.groupedShapes?.[2]).toMatchObject({ kind: "text", text: "NAME", height: 1 });
    const phoneStand = makeShapeFromAsset(byId("printable-phone-stand"));
    expect(phoneStand).toMatchObject({ kind: "box", width: 70, depth: 70, height: 50, groupedBaseWidth: 70, groupedBaseDepth: 70, groupedBaseHeight: 50 });
    expect(phoneStand.groupedShapes).toHaveLength(3);
    expect(phoneStand.groupedShapes?.map((shape) => shape.name)).toEqual(["Phone stand base", "Phone stand back", "Phone stand retaining lip"]);
    expect(phoneStand.groupedShapes?.[1]).toMatchObject({ width: 70, depth: 4, height: 45, rotationX: -15 });

    [nameTag, phoneStand].forEach((assembly) => {
      const baseHeight = assembly.groupedBaseHeight!;
      assembly.groupedShapes!.forEach((part) => {
        expect(part.elevation ?? 0).toBeGreaterThanOrEqual(0);
        expect((part.elevation ?? 0) + part.height).toBeLessThanOrEqual(baseHeight);
      });
    });
    expect(makeShapeFromAsset(byId("printable-cable-guide"))).toMatchObject({ kind: "tube", width: 18, depth: 18, height: 8, bevel: 4 });
    expect(makeShapeFromAsset(byId("printable-spacer"))).toMatchObject({ kind: "tube", width: 12, depth: 12, height: 10, bevel: 3 });
  });

  it("creates placed shapes from toolbar assets", () => {
    const asset: ShapeAsset = { id: "box", name: "Box", src: "box.png", kind: "box", color: "#d41721" };
    const placed = makeShapeFromAsset(asset, { x: 12, z: -8, elevation: 4 });

    expect(placed.id).toMatch(/^box-/);
    expect(placed).toMatchObject({
      name: "Box",
      kind: "box",
      color: "#d41721",
      x: 12,
      z: -8,
      elevation: 4,
      size: 20,
      width: 20,
      depth: 20,
      height: 20,
      radius: 0,
      steps: 10,
      locked: false,
      hidden: false,
    });
  });

  it("uses shape-specific defaults for text and round profiles", () => {
    const text = makeShapeFromAsset({ id: "text", name: "Text", src: "text.png", kind: "text", color: "#cf101b" });
    const torus = makeShapeFromAsset({ id: "torus", name: "Torus", src: "torus.png", kind: "torus", color: "#0098c7" });

    expect(text).toMatchObject({ width: 86, depth: 28, height: 10, text: "TEXT", font: "Multilanguage" });
    expect(torus).toMatchObject({ size: 22, width: 22, depth: 22, height: 5 });
  });

  it("creates canonical scene shapes with stable defaults", () => {
    const created = sceneShape({
      name: "Part",
      kind: "box",
      color: "#d41721",
      width: 12,
      depth: 18,
      rotation: 359.9,
      mirrorX: false,
    });

    expect(created.id).toMatch(/^shape-/);
    expect(created).toMatchObject({
      name: "Part",
      kind: "box",
      color: "#d41721",
      x: 0,
      z: 0,
      elevation: 0,
      width: 12,
      depth: 18,
      height: 20,
      size: 18,
      rotation: 0,
      locked: false,
      hidden: false,
    });
    expect(created.mirrorX).toBeUndefined();
  });
});
