import { describe, expect, it } from "vitest";
import type { ShapeAsset } from "@/types/sketchforge";
import { connectorShapeAssets, makeShapeFromAsset, sceneShape, shapeLibraryCategories, toolbarShapeAssets } from "@/lib/shapeCatalog";

describe("shape catalog", () => {
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
