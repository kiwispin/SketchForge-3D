import { canonicalizeShape } from "@/lib/workplaneShapes";
import { createLocalId } from "@/lib/localIds";
import type { ShapeAsset, WorkplaneShape } from "@/types/sketchforge";

export type ToolbarShapeAsset = ShapeAsset & { menuIcon: string };
export type ShapeLibraryCategory = {
  id: "basic" | "connectors" | "printableParts" | "text";
  label: string;
  shapes: ToolbarShapeAsset[];
};

export const toolbarShapeAssets: ToolbarShapeAsset[] = [
  { id: "box", name: "Box", src: "assets/sketchforge/shape-icons-gray/box.png", menuIcon: "assets/sketchforge/shape-icons-gray/box.png", kind: "box", color: "#d41721" },
  { id: "cylinder", name: "Cylinder", src: "assets/sketchforge/shape-icons-gray/cylinder.png", menuIcon: "assets/sketchforge/shape-icons-gray/cylinder.png", kind: "cylinder", color: "#d97813" },
  { id: "sphere", name: "Sphere", src: "assets/sketchforge/shape-icons-gray/sphere.png", menuIcon: "assets/sketchforge/shape-icons-gray/sphere.png", kind: "sphere", color: "#0098c7" },
  { id: "cone", name: "Cone", src: "assets/sketchforge/shape-icons-gray/cone.png", menuIcon: "assets/sketchforge/shape-icons-gray/cone.png", kind: "cone", color: "#6e2786" },
  { id: "pyramid", name: "Pyramid", src: "assets/sketchforge/shape-icons-gray/pyramid.png", menuIcon: "assets/sketchforge/shape-icons-gray/pyramid.png", kind: "pyramid", color: "#f2cf10" },
  { id: "wedge", name: "Wedge", src: "assets/sketchforge/shape-icons-gray/wedge.png", menuIcon: "assets/sketchforge/shape-icons-gray/wedge.png", kind: "wedge", color: "#33983d" },
  { id: "text", name: "Text", src: "assets/sketchforge/shape-icons-gray/text.png", menuIcon: "assets/sketchforge/shape-icons-gray/text.png", kind: "text", color: "#cf101b" },
  { id: "round-roof", name: "Round Roof", src: "assets/sketchforge/shape-icons-gray/round-roof.png", menuIcon: "assets/sketchforge/shape-icons-gray/round-roof.png", kind: "roundRoof", color: "#67c4ce" },
  { id: "half-sphere", name: "Half Sphere", src: "assets/sketchforge/shape-icons-gray/half-sphere.png", menuIcon: "assets/sketchforge/shape-icons-gray/half-sphere.png", kind: "halfSphere", color: "#c9009a" },
  { id: "torus", name: "Torus", src: "assets/sketchforge/shape-icons-gray/torus.png", menuIcon: "assets/sketchforge/shape-icons-gray/torus.png", kind: "torus", color: "#0098c7" },
  { id: "tube", name: "Tube", src: "assets/sketchforge/shape-icons-gray/tube.png", menuIcon: "assets/sketchforge/shape-icons-gray/tube.png", kind: "tube", color: "#ce7013" },
];

export const connectorShapeAssets: ToolbarShapeAsset[] = [
  { id: "connector-peg", name: "Peg", src: "assets/sketchforge/shape-icons-gray/cylinder.png", menuIcon: "assets/sketchforge/shape-icons-gray/cylinder.png", kind: "cylinder", color: "#2563eb" },
  { id: "connector-socket", name: "Socket", src: "assets/sketchforge/shape-icons-gray/cylinder.png", menuIcon: "assets/sketchforge/shape-icons-gray/cylinder-hole.png", kind: "cylinder", color: "#94a3b8", hole: true },
];

export const printablePartShapeAssets: ToolbarShapeAsset[] = [
  { id: "printable-name-tag", name: "Name Tag", src: "assets/sketchforge/shape-icons-gray/box.png", menuIcon: "assets/sketchforge/shape-icons-gray/box.png", kind: "box", color: "#d41721" },
  { id: "printable-phone-stand", name: "Phone Stand", src: "assets/sketchforge/shape-icons-gray/wedge.png", menuIcon: "assets/sketchforge/shape-icons-gray/wedge.png", kind: "wedge", color: "#33983d" },
  { id: "printable-cable-guide", name: "Cable Guide", src: "assets/sketchforge/shape-icons-gray/tube.png", menuIcon: "assets/sketchforge/shape-icons-gray/tube.png", kind: "tube", color: "#ce7013" },
  { id: "printable-spacer", name: "Spacer", src: "assets/sketchforge/shape-icons-gray/tube.png", menuIcon: "assets/sketchforge/shape-icons-gray/tube.png", kind: "tube", color: "#2563eb" },
];

export const shapeLibraryCategories: ShapeLibraryCategory[] = [
  { id: "basic", label: "Basic Shapes", shapes: toolbarShapeAssets.filter((shape) => shape.kind !== "text") },
  { id: "connectors", label: "Connectors", shapes: connectorShapeAssets },
  { id: "printableParts", label: "Printable Parts", shapes: printablePartShapeAssets },
  { id: "text", label: "Text", shapes: toolbarShapeAssets.filter((shape) => shape.kind === "text") },
];

export function sceneShape(shape: Partial<WorkplaneShape> & Pick<WorkplaneShape, "name" | "kind" | "color">): WorkplaneShape {
  const width = shape.width ?? shape.size ?? 20;
  const depth = shape.depth ?? shape.size ?? 20;
  const height = shape.height ?? 20;
  return canonicalizeShape({
    id: shape.id ?? createLocalId("shape"),
    name: shape.name,
    kind: shape.kind,
    color: shape.color,
    hole: shape.hole,
    x: shape.x ?? 0,
    z: shape.z ?? 0,
    elevation: shape.elevation ?? 0,
    size: shape.size ?? Math.max(width, depth),
    width,
    depth,
    height,
    rotation: shape.rotation ?? 0,
    rotationX: shape.rotationX ?? 0,
    rotationZ: shape.rotationZ ?? 0,
    radius: shape.radius,
    steps: shape.steps,
    sides: shape.sides,
    bevel: shape.bevel,
    segments: shape.segments,
    topRadius: shape.topRadius,
    baseRadius: shape.baseRadius,
    text: shape.text,
    font: shape.font,
    importedMesh: shape.importedMesh,
    imagePlate: shape.imagePlate,
    groupedShapes: shape.groupedShapes,
    groupedBaseWidth: shape.groupedBaseWidth,
    groupedBaseDepth: shape.groupedBaseDepth,
    groupedBaseHeight: shape.groupedBaseHeight,
    locked: shape.locked ?? false,
    hidden: shape.hidden ?? false,
  });
}

export function makeShapeFromAsset(asset: ShapeAsset, point?: { x: number; z: number; elevation?: number }): WorkplaneShape {
  const isConnectorPeg = asset.id === "connector-peg";
  const isConnectorSocket = asset.id === "connector-socket";
  const isNameTag = asset.id === "printable-name-tag";
  const isPhoneStand = asset.id === "printable-phone-stand";
  const isCableGuide = asset.id === "printable-cable-guide";
  const isSpacer = asset.id === "printable-spacer";
  const roundProfile = asset.kind === "sphere" || asset.kind === "torus" || asset.kind === "ring" || asset.kind === "halfSphere";
  const flatProfile = asset.kind === "torus" || asset.kind === "ring" || asset.kind === "text";
  const size = isConnectorPeg ? 8 : isConnectorSocket ? 10 : isCableGuide ? 18 : isSpacer ? 12 : roundProfile ? 22 : 20;
  const height = isConnectorPeg ? 16 : isConnectorSocket ? 12 : isNameTag ? 3 : isPhoneStand ? 45 : isCableGuide ? 8 : isSpacer ? 10 : asset.kind === "text" ? 10 : asset.kind === "roundRoof" ? 10 : asset.kind === "halfSphere" ? 11 : flatProfile ? 5 : 20;
  const width = isNameTag || isPhoneStand ? 70 : asset.kind === "text" ? 86 : size;
  const depth = isNameTag ? 28 : isPhoneStand ? 60 : asset.kind === "text" ? 28 : size;

  if (isPhoneStand) {
    const color = asset.color;
    const child = (id: string, name: string, x: number, z: number, elevation: number, childWidth: number, childDepth: number, childHeight: number, rotationX = 0): WorkplaneShape => ({
      id: createLocalId(id),
      name,
      kind: "box",
      color,
      x,
      z,
      elevation,
      size: Math.max(childWidth, childDepth),
      width: childWidth,
      depth: childDepth,
      height: childHeight,
      rotation: 0,
      rotationX,
      rotationZ: 0,
      locked: false,
      hidden: false,
    });
    return {
      id: createLocalId(asset.id),
      name: asset.name,
      kind: "box",
      color,
      x: point?.x ?? 0,
      z: point?.z ?? 0,
      elevation: point?.elevation ?? 0,
      size: 70,
      width: 70,
      depth: 70,
      height: 50,
      rotation: 0,
      rotationX: 0,
      rotationZ: 0,
      groupedBaseWidth: 70,
      groupedBaseDepth: 70,
      groupedBaseHeight: 50,
      groupedShapes: [
        child("phone-stand-base", "Phone stand base", 0, 0, 0, 70, 70, 4),
        child("phone-stand-back", "Phone stand back", 0, 25, 3, 70, 4, 45, -15),
        child("phone-stand-lip", "Phone stand retaining lip", 0, -23, 4, 70, 6, 8),
      ],
      locked: false,
      hidden: false,
    };
  }

  return {
    id: createLocalId(asset.id),
    name: asset.name,
    kind: asset.kind,
    color: asset.color,
    hole: asset.hole,
    x: point?.x ?? 0,
    z: point?.z ?? 0,
    elevation: point?.elevation ?? 0,
    size,
    width,
    depth,
    height,
    rotation: 0,
    rotationX: 0,
    rotationZ: 0,
    radius: asset.kind === "box" ? (isNameTag ? 3 : 0) : undefined,
    text: asset.kind === "text" ? "TEXT" : undefined,
    font: asset.kind === "text" ? "Multilanguage" : undefined,
    steps: asset.kind === "box" ? 10 : asset.kind === "sphere" ? 24 : asset.kind === "halfSphere" ? 32 : undefined,
    sides: asset.kind === "cylinder" || asset.kind === "cone" ? (isConnectorPeg || isConnectorSocket ? 48 : 96) : asset.kind === "roundRoof" ? 64 : asset.kind === "pyramid" ? 4 : undefined,
    bevel: asset.kind === "cylinder" ? 0 : asset.kind === "tube" || asset.kind === "ring" ? (isSpacer ? 3 : 4) : undefined,
    segments: asset.kind === "cylinder" ? 1 : undefined,
    topRadius: asset.kind === "cone" ? 0 : undefined,
    baseRadius: asset.kind === "cone" ? size / 2 : undefined,
    locked: false,
    hidden: false,
  };
}
