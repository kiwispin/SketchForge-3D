import { canonicalizeShape, shapeDepth, shapeWidth } from "@/lib/workplaneShapes";
import { createLocalId } from "@/lib/localIds";
import * as THREE from "three";
import type { ShapeAsset, WorkplaneShape, WorkplaneWorkspaceSettings } from "@/types/sketchforge";

export type ToolbarShapeAsset = ShapeAsset & { menuIcon: string };
export type SurfacePlacement = {
  orientation: "ground" | "top" | "bottom" | "front" | "back" | "right" | "left" | "face";
  x: number;
  y: number;
  z: number;
  normal?: [number, number, number];
};
export type ShapeLibraryCategory = {
  id: "basic" | "connectors" | "architectural" | "printableParts" | "text";
  label: string;
  shapes: ToolbarShapeAsset[];
};

const AUTOMATIC_PLACEMENT_CLEARANCE = 2;

type HorizontalFootprint = {
  halfWidth: number;
  halfDepth: number;
};

function horizontalFootprint(shape: WorkplaneShape): HorizontalFootprint {
  const width = shapeWidth(shape);
  const depth = shapeDepth(shape);
  const radians = ((shape.rotation ?? 0) * Math.PI) / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  return {
    halfWidth: (width * cosine + depth * sine) / 2,
    halfDepth: (width * sine + depth * cosine) / 2,
  };
}

function verticalRangesOverlap(a: WorkplaneShape, b: WorkplaneShape) {
  const aBottom = a.elevation ?? 0;
  const bBottom = b.elevation ?? 0;
  return aBottom < bBottom + b.height - 0.01 && aBottom + a.height > bBottom + 0.01;
}

function overlapsPlacedShape(
  x: number,
  z: number,
  footprint: HorizontalFootprint,
  draft: WorkplaneShape,
  existing: WorkplaneShape,
) {
  if (existing.hidden || existing.hole || !verticalRangesOverlap(draft, existing)) {
    return false;
  }
  const existingFootprint = horizontalFootprint(existing);
  return (
    Math.abs(x - existing.x) < footprint.halfWidth + existingFootprint.halfWidth + AUTOMATIC_PLACEMENT_CLEARANCE &&
    Math.abs(z - existing.z) < footprint.halfDepth + existingFootprint.halfDepth + AUTOMATIC_PLACEMENT_CLEARANCE
  );
}

/**
 * Finds the closest grid point to the workplane origin where a newly clicked
 * library shape is clear of visible solid shapes at the same elevation.
 * Dragging bypasses this helper so intentional overlaps remain possible.
 */
export function automaticShapePlacement(
  asset: ShapeAsset,
  shapes: WorkplaneShape[],
  workspace: Pick<WorkplaneWorkspaceSettings, "width" | "depth">,
  elevation = 0,
) {
  const draft = makeShapeFromAsset(asset, { x: 0, z: 0, elevation });
  const footprint = horizontalFootprint(draft);
  const xLimit = workspace.width / 2 - footprint.halfWidth - AUTOMATIC_PLACEMENT_CLEARANCE;
  const zLimit = workspace.depth / 2 - footprint.halfDepth - AUTOMATIC_PLACEMENT_CLEARANCE;
  if (xLimit < 0 || zLimit < 0) {
    return null;
  }

  const step = Math.max(2, Math.min(5, Math.min(footprint.halfWidth, footprint.halfDepth)));
  const maxRing = Math.ceil(Math.max(xLimit, zLimit) / step);
  for (let ring = 0; ring <= maxRing; ring += 1) {
    const candidates: Array<{ x: number; z: number }> = [];
    for (let gridX = -ring; gridX <= ring; gridX += 1) {
      for (let gridZ = -ring; gridZ <= ring; gridZ += 1) {
        if (Math.max(Math.abs(gridX), Math.abs(gridZ)) !== ring) {
          continue;
        }
        const x = gridX * step;
        const z = gridZ * step;
        if (Math.abs(x) <= xLimit && Math.abs(z) <= zLimit) {
          candidates.push({ x, z });
        }
      }
    }
    candidates.sort((a, b) => a.x ** 2 + a.z ** 2 - (b.x ** 2 + b.z ** 2));
    const placement = candidates.find(({ x, z }) => !shapes.some((shape) => overlapsPlacedShape(x, z, footprint, draft, shape)));
    if (placement) {
      return {
        x: Object.is(placement.x, -0) ? 0 : placement.x,
        z: Object.is(placement.z, -0) ? 0 : placement.z,
        elevation,
      };
    }
  }
  return null;
}

export const toolbarShapeAssets: ToolbarShapeAsset[] = [
  { id: "box", name: "Box", src: "assets/sketchforge/box-red.png", menuIcon: "assets/sketchforge/box-red.png", kind: "box", color: "#d41721" },
  { id: "cylinder", name: "Cylinder", src: "assets/sketchforge/cylinder-orange.png", menuIcon: "assets/sketchforge/cylinder-orange.png", kind: "cylinder", color: "#d97813" },
  { id: "sphere", name: "Sphere", src: "assets/sketchforge/sphere-blue.png", menuIcon: "assets/sketchforge/sphere-blue.png", kind: "sphere", color: "#0098c7" },
  { id: "cone", name: "Cone", src: "assets/sketchforge/cone-purple.png", menuIcon: "assets/sketchforge/cone-purple.png", kind: "cone", color: "#6e2786" },
  { id: "pyramid", name: "Pyramid", src: "assets/sketchforge/pyramid-yellow.png", menuIcon: "assets/sketchforge/pyramid-yellow.png", kind: "pyramid", color: "#d6ad00" },
  { id: "wedge", name: "Wedge", src: "assets/sketchforge/wedge-blue.png", menuIcon: "assets/sketchforge/wedge-blue.png", kind: "wedge", color: "#33983d" },
  { id: "text", name: "Text", src: "assets/sketchforge/text-red.png", menuIcon: "assets/sketchforge/text-red.png", kind: "text", color: "#cf101b" },
  { id: "round-roof", name: "Round Roof", src: "assets/sketchforge/round-roof-cyan.png", menuIcon: "assets/sketchforge/round-roof-cyan.png", kind: "roundRoof", color: "#00a6a6" },
  { id: "half-sphere", name: "Half Sphere", src: "assets/sketchforge/half-sphere-pink.png", menuIcon: "assets/sketchforge/half-sphere-pink.png", kind: "halfSphere", color: "#c9009a" },
  { id: "torus", name: "Torus", src: "assets/sketchforge/torus-blue.png", menuIcon: "assets/sketchforge/torus-blue.png", kind: "torus", color: "#4f46e5" },
  { id: "tube", name: "Tube", src: "assets/sketchforge/tube-orange.png", menuIcon: "assets/sketchforge/tube-orange.png", kind: "tube", color: "#9a5b13" },
];

export const connectorShapeAssets: ToolbarShapeAsset[] = [
  { id: "connector-peg", name: "Peg", src: "assets/sketchforge/cylinder-orange.png", menuIcon: "assets/sketchforge/cylinder-orange.png", kind: "cylinder", color: "#2563eb" },
  { id: "connector-socket", name: "Socket", src: "assets/sketchforge/cylinder-hole.png", menuIcon: "assets/sketchforge/cylinder-hole.png", kind: "cylinder", color: "#94a3b8", hole: true },
];

export const printablePartShapeAssets: ToolbarShapeAsset[] = [
  { id: "printable-name-tag", name: "Name Tag", src: "assets/sketchforge/printable-name-tag.svg", menuIcon: "assets/sketchforge/printable-name-tag.svg", kind: "box", color: "#d41721" },
  { id: "printable-phone-stand", name: "Phone Stand", src: "assets/sketchforge/printable-phone-stand.svg", menuIcon: "assets/sketchforge/printable-phone-stand.svg", kind: "wedge", color: "#33983d" },
  { id: "printable-cable-guide", name: "Cable Guide", src: "assets/sketchforge/printable-cable-guide.svg", menuIcon: "assets/sketchforge/printable-cable-guide.svg", kind: "tube", color: "#ce7013" },
  { id: "printable-spacer", name: "Spacer", src: "assets/sketchforge/printable-spacer.svg", menuIcon: "assets/sketchforge/printable-spacer.svg", kind: "tube", color: "#2563eb" },
];

export const architecturalShapeAssets: ToolbarShapeAsset[] = [
  { id: "architectural-wall", name: "Wall", src: "assets/sketchforge/architectural-wall.svg", menuIcon: "assets/sketchforge/architectural-wall.svg", kind: "box", color: "#b96f43" },
  { id: "architectural-window", name: "Window", src: "assets/sketchforge/architectural-window.svg", menuIcon: "assets/sketchforge/architectural-window.svg", kind: "box", color: "#2f9fc2" },
  { id: "architectural-door", name: "Door", src: "assets/sketchforge/architectural-door.svg", menuIcon: "assets/sketchforge/architectural-door.svg", kind: "box", color: "#8c5738" },
  { id: "architectural-roof", name: "Roof", src: "assets/sketchforge/architectural-roof.svg", menuIcon: "assets/sketchforge/architectural-roof.svg", kind: "roundRoof", color: "#377b5b" },
];

export const shapeLibraryCategories: ShapeLibraryCategory[] = [
  { id: "basic", label: "Basic Shapes", shapes: toolbarShapeAssets.filter((shape) => shape.kind !== "text") },
  { id: "connectors", label: "Connectors", shapes: connectorShapeAssets },
  { id: "architectural", label: "Architectural", shapes: architecturalShapeAssets },
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

function applySurfacePlacement(shape: WorkplaneShape, point?: { surface?: SurfacePlacement; rotation?: number; rotationX?: number; rotationZ?: number }) {
  if (!point?.surface) {
    return shape;
  }
  const surface = point.surface;
  const { orientation, x, y, z } = surface;
  const height = shape.height;
  const next = { ...shape, rotation: point.rotation ?? shape.rotation ?? 0, rotationX: point.rotationX ?? shape.rotationX ?? 0, rotationZ: point.rotationZ ?? shape.rotationZ ?? 0 };
  if (orientation === "face" && surface.normal) {
    const normal = new THREE.Vector3(...surface.normal).normalize();
    const center = new THREE.Vector3(x, y, z).addScaledVector(normal, height / 2);
    next.x = center.x;
    next.z = center.z;
    next.elevation = center.y - height / 2;
  } else if (orientation === "ground" || orientation === "top") {
    next.x = x;
    next.z = z;
    next.elevation = y;
  } else if (orientation === "bottom") {
    next.x = x;
    next.z = z;
    next.elevation = y - height;
  } else if (orientation === "front") {
    next.x = x;
    next.z = z + height / 2;
    next.elevation = y - height / 2;
  } else if (orientation === "back") {
    next.x = x;
    next.z = z - height / 2;
    next.elevation = y - height / 2;
  } else if (orientation === "right") {
    next.x = x + height / 2;
    next.z = z;
    next.elevation = y - height / 2;
  } else {
    next.x = x - height / 2;
    next.z = z;
    next.elevation = y - height / 2;
  }
  return next;
}

export function makeShapeFromAsset(asset: ShapeAsset, point?: { x: number; z: number; elevation?: number; rotation?: number; rotationX?: number; rotationZ?: number; surface?: SurfacePlacement }): WorkplaneShape {
  const isConnectorPeg = asset.id === "connector-peg";
  const isConnectorSocket = asset.id === "connector-socket";
  const isNameTag = asset.id === "printable-name-tag";
  const isPhoneStand = asset.id === "printable-phone-stand";
  const isCableGuide = asset.id === "printable-cable-guide";
  const isSpacer = asset.id === "printable-spacer";
  const isArchitecturalWall = asset.id === "architectural-wall";
  const isArchitecturalWindow = asset.id === "architectural-window";
  const isArchitecturalDoor = asset.id === "architectural-door";
  const isArchitecturalRoof = asset.id === "architectural-roof";
  const roundProfile = asset.kind === "sphere" || asset.kind === "torus" || asset.kind === "ring" || asset.kind === "halfSphere";
  const flatProfile = asset.kind === "torus" || asset.kind === "ring" || asset.kind === "text";
  const size = isConnectorPeg ? 8 : isConnectorSocket ? 10 : isCableGuide ? 18 : isSpacer ? 12 : isArchitecturalWall ? 80 : isArchitecturalWindow ? 50 : isArchitecturalDoor ? 50 : isArchitecturalRoof ? 80 : roundProfile ? 22 : 20;
  const height = isConnectorPeg ? 16 : isConnectorSocket ? 12 : isNameTag ? 3 : isPhoneStand ? 45 : isCableGuide ? 8 : isSpacer ? 10 : isArchitecturalWall ? 40 : isArchitecturalWindow ? 44 : isArchitecturalDoor ? 64 : isArchitecturalRoof ? 20 : asset.kind === "text" ? 10 : asset.kind === "roundRoof" ? 10 : asset.kind === "halfSphere" ? 11 : flatProfile ? 5 : 20;
  const width = isNameTag || isPhoneStand ? 70 : isArchitecturalWall ? 80 : isArchitecturalWindow || isArchitecturalDoor ? 50 : isArchitecturalRoof ? 80 : asset.kind === "text" ? 86 : size;
  const depth = isNameTag ? 28 : isPhoneStand ? 60 : isArchitecturalWall ? 8 : isArchitecturalWindow ? 6 : isArchitecturalDoor ? 8 : isArchitecturalRoof ? 60 : asset.kind === "text" ? 28 : size;

  if (isNameTag) {
    const color = asset.color;
    const child = (id: string, name: string, kind: WorkplaneShape["kind"], x: number, z: number, elevation: number, childWidth: number, childDepth: number, childHeight: number, overrides: Partial<WorkplaneShape> = {}): WorkplaneShape => ({
      id: createLocalId(id), name, kind, color: overrides.color ?? color, x, z, elevation,
      size: Math.max(childWidth, childDepth), width: childWidth, depth: childDepth, height: childHeight,
      rotation: 0, rotationX: 0, rotationZ: 0, locked: false, hidden: false, ...overrides,
    });
    return applySurfacePlacement({
      id: createLocalId(asset.id), name: asset.name, kind: "box", color,
      x: point?.x ?? 0, z: point?.z ?? 0, elevation: point?.elevation ?? 0,
      size: 70, width: 70, depth: 28, height: 5, rotation: 0, rotationX: point?.rotationX ?? 0, rotationZ: point?.rotationZ ?? 0,
      groupedBaseWidth: 70, groupedBaseDepth: 28, groupedBaseHeight: 5,
      groupedShapes: [
        child("name-tag-plaque", "Name tag plaque", "box", 0, 0, 0, 70, 28, 4, { radius: 4, steps: 10 }),
        child("name-tag-hole", "Keyring hole", "cylinder", -28, 0, 0, 6, 6, 5, { hole: true, color: "#b8c2cc", sides: 48 }),
        child("name-tag-label", "NAME label", "text", 5, 0, 4, 42, 14, 1, { color: "#ffffff", text: "NAME", font: "Sans" }),
      ],
      locked: false, hidden: false,
    }, point);
  }

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
    return applySurfacePlacement({
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
      rotationX: point?.rotationX ?? 0,
      rotationZ: point?.rotationZ ?? 0,
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
    }, point);
  }

  if (isArchitecturalWindow || isArchitecturalDoor) {
    const color = asset.color;
    const child = (id: string, name: string, childWidth: number, childDepth: number, childHeight: number, x: number, z: number, elevation: number, childColor = color): WorkplaneShape => ({
      id: createLocalId(id), name, kind: "box", color: childColor, x, z, elevation,
      size: Math.max(childWidth, childDepth), width: childWidth, depth: childDepth, height: childHeight,
      rotation: 0, rotationX: 0, rotationZ: 0, locked: false, hidden: false,
    });
    const window = isArchitecturalWindow;
    const baseWidth = window ? 50 : 50;
    const baseDepth = window ? 6 : 8;
    const baseHeight = window ? 44 : 64;
    const children = window
      ? [
          child("architectural-window-glass", "Window glass", 38, 2, 32, 0, 0, 6, "#8ed5e8"),
          child("architectural-window-left", "Window left frame", 4, 6, 44, -23, 0, 0),
          child("architectural-window-right", "Window right frame", 4, 6, 44, 23, 0, 0),
          child("architectural-window-sill", "Window sill", 50, 8, 4, 0, 0, 0),
          child("architectural-window-header", "Window header", 50, 6, 4, 0, 0, 40),
        ]
      : [
          child("architectural-door-leaf", "Door leaf", 42, 4, 56, 0, 0, 0, "#a96b43"),
          child("architectural-door-left", "Door left frame", 4, 8, 64, -23, 0, 0),
          child("architectural-door-right", "Door right frame", 4, 8, 64, 23, 0, 0),
          child("architectural-door-header", "Door header", 50, 8, 4, 0, 0, 60),
          child("architectural-door-handle", "Door handle", 3, 3, 3, 14, -2, 28, "#e2bd52"),
        ];
    return applySurfacePlacement({
      id: createLocalId(asset.id), name: asset.name, kind: "box", color,
      x: point?.x ?? 0, z: point?.z ?? 0, elevation: point?.elevation ?? 0,
      size: baseWidth, width: baseWidth, depth: baseDepth, height: baseHeight,
      rotation: 0, rotationX: point?.rotationX ?? 0, rotationZ: point?.rotationZ ?? 0,
      groupedBaseWidth: baseWidth, groupedBaseDepth: baseDepth, groupedBaseHeight: baseHeight,
      groupedShapes: children, locked: false, hidden: false,
    }, point);
  }

  return applySurfacePlacement({
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
    rotationX: point?.rotationX ?? 0,
    rotationZ: point?.rotationZ ?? 0,
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
  }, point);
}
