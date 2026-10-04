import { describe, expect, it } from "vitest";
import {
  PROJECT_FILE_FORMAT,
  PROJECT_FILE_VERSION,
  isProjectFileName,
  looksLikeProjectFile,
  parseProjectFile,
  projectFileNameStem,
  restoredProjectFromLegacyFile,
} from "@/lib/projectFile";
import { exportSkfProject, importSkfProject } from "@/lib/skfProject";
import { DEFAULT_WORKPLANE_WORKSPACE } from "@/lib/workplaneSettings";
import type { GridSize, WorkplaneShape, WorkplaneWorkspaceSettings } from "@/types/sketchforge";

// SketchForge no longer writes .sketchforge files; this builds the exact
// envelope the fork's serializeProjectFile wrote, as a fixture for the reader.
function legacyFileText(payload: { name: string; workspace?: WorkplaneWorkspaceSettings; snapGrid?: GridSize; shapes: WorkplaneShape[] }, savedAt = 1_752_300_000_000) {
  return JSON.stringify({
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    savedAt,
    app: { name: "SketchForge", version: "0.5.0" },
    project: {
      name: payload.name,
      workspace: payload.workspace ?? DEFAULT_WORKPLANE_WORKSPACE,
      snapGrid: payload.snapGrid ?? "1.0 mm",
      shapes: payload.shapes,
    },
  });
}

const solidBox: WorkplaneShape = {
  id: "shape-box-1",
  name: "Box",
  kind: "box",
  color: "#e2504c",
  x: 5,
  z: -3,
  elevation: 2,
  size: 20,
  width: 20,
  depth: 24,
  height: 12,
  rotation: 45,
};

const holeCylinder: WorkplaneShape = {
  id: "shape-cyl-1",
  name: "Cylinder",
  kind: "cylinder",
  color: "#8899aa",
  hole: true,
  x: 0,
  z: 0,
  size: 16,
  width: 16,
  depth: 16,
  height: 30,
  rotation: 0,
  sides: 64,
};

const groupShape: WorkplaneShape = {
  id: "shape-group-1",
  name: "Group",
  kind: "box",
  color: "#e2504c",
  x: 0,
  z: 0,
  size: 24,
  width: 24,
  depth: 24,
  height: 24,
  rotation: 0,
  groupedShapes: [solidBox, holeCylinder],
};

const importedMeshShape: WorkplaneShape = {
  id: "shape-mesh-1",
  name: "bracket.stl",
  kind: "mesh",
  color: "#4a90d9",
  x: 1,
  z: 2,
  size: 10,
  width: 10,
  depth: 10,
  height: 5,
  rotation: 0,
  importedMesh: {
    positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
    baseWidth: 10,
    baseDepth: 10,
    baseHeight: 5,
    triangleCount: 1,
    sourceFormat: "stl",
  },
};

describe("parseProjectFile", () => {
  it("reads name, settings, and shapes including groups, holes, and meshes", () => {
    const workspace = { ...DEFAULT_WORKPLANE_WORKSPACE, width: 300, showGrid: false };
    const text = legacyFileText({
      name: "Bracket v2",
      workspace,
      snapGrid: "0.5 mm",
      shapes: [groupShape, importedMeshShape],
    });

    const parsed = parseProjectFile(text);

    expect(parsed.name).toBe("Bracket v2");
    expect(parsed.workspace.width).toBe(300);
    expect(parsed.workspace.showGrid).toBe(false);
    expect(parsed.snapGrid).toBe("0.5 mm");
    expect(parsed.droppedShapeCount).toBe(0);
    expect(parsed.shapes).toHaveLength(2);

    const [parsedGroup, parsedMesh] = parsed.shapes;
    expect(parsedGroup.id).toBe("shape-group-1");
    expect(parsedGroup.groupedShapes).toHaveLength(2);
    expect(parsedGroup.groupedShapes?.[0].rotation).toBe(45);
    expect(parsedGroup.groupedShapes?.[1].hole).toBe(true);
    expect(parsedMesh.importedMesh?.positions).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect(parsedMesh.importedMesh?.sourceFormat).toBe("stl");
  });

  it("defaults workspace and snap grid when the file omits them", () => {
    const text = JSON.stringify({
      format: "sketchforge-project",
      version: 1,
      project: { name: "Minimal", shapes: [] },
    });
    const parsed = parseProjectFile(text);
    expect(parsed.workspace).toEqual(DEFAULT_WORKPLANE_WORKSPACE);
    expect(parsed.snapGrid).toBe("1.0 mm");
    expect(parsed.name).toBe("Minimal");
  });

  it("rejects content that is not JSON", () => {
    expect(() => parseProjectFile("solid teapot")).toThrowError(
      "This file isn't a SketchForge project",
    );
  });

  it("rejects JSON that is not a SketchForge project", () => {
    expect(() => parseProjectFile(JSON.stringify({ format: "other", version: 1 }))).toThrowError(
      "This file isn't a SketchForge project",
    );
    expect(() => parseProjectFile(JSON.stringify([1, 2, 3]))).toThrowError(
      "This file isn't a SketchForge project",
    );
    expect(() =>
      parseProjectFile(JSON.stringify({ format: "sketchforge-project", version: 1, project: { name: "X" } })),
    ).toThrowError("This file isn't a SketchForge project");
  });

  it("rejects files from a newer SketchForge", () => {
    const text = JSON.stringify({
      format: "sketchforge-project",
      version: PROJECT_FILE_VERSION + 1,
      project: { name: "Future", shapes: [] },
    });
    expect(() => parseProjectFile(text)).toThrowError(
      "This project was made with a newer version of SketchForge",
    );
  });

  it("drops malformed shape entries individually and reports the count", () => {
    const text = JSON.stringify({
      format: "sketchforge-project",
      version: 1,
      project: {
        name: "Partial",
        shapes: [solidBox, null, { kind: "box" }, holeCylinder, 42],
      },
    });
    const parsed = parseProjectFile(text);
    expect(parsed.shapes).toHaveLength(2);
    expect(parsed.shapes[0].id).toBe("shape-box-1");
    expect(parsed.shapes[1].id).toBe("shape-cyl-1");
    expect(parsed.droppedShapeCount).toBe(3);
  });

  it("drops group shapes whose groupedShapes entries are malformed", () => {
    const text = JSON.stringify({
      format: "sketchforge-project",
      version: 1,
      project: {
        name: "Bad group entries",
        shapes: [solidBox, { ...groupShape, groupedShapes: [null] }, holeCylinder],
      },
    });
    const parsed = parseProjectFile(text);
    expect(parsed.shapes).toHaveLength(2);
    expect(parsed.shapes[0].id).toBe("shape-box-1");
    expect(parsed.shapes[1].id).toBe("shape-cyl-1");
    expect(parsed.droppedShapeCount).toBe(1);
  });

  it("drops group shapes whose groupedShapes is not an array", () => {
    const text = JSON.stringify({
      format: "sketchforge-project",
      version: 1,
      project: {
        name: "Bad group value",
        shapes: [solidBox, { ...groupShape, groupedShapes: 42 }, holeCylinder],
      },
    });
    const parsed = parseProjectFile(text);
    expect(parsed.shapes).toHaveLength(2);
    expect(parsed.shapes[0].id).toBe("shape-box-1");
    expect(parsed.shapes[1].id).toBe("shape-cyl-1");
    expect(parsed.droppedShapeCount).toBe(1);
  });

  it("falls back to a usable project name", () => {
    const text = JSON.stringify({
      format: "sketchforge-project",
      version: 1,
      project: { name: "   ", shapes: [] },
    });
    expect(parseProjectFile(text).name).toBe("Imported design");
  });
});

describe("isProjectFileName", () => {
  it("matches .sketchforge and .sketchforge.json case-insensitively", () => {
    expect(isProjectFileName("part.sketchforge")).toBe(true);
    expect(isProjectFileName("PART.SKETCHFORGE")).toBe(true);
    expect(isProjectFileName("part.sketchforge.json")).toBe(true);
  });

  it("rejects other extensions", () => {
    expect(isProjectFileName("part.stl")).toBe(false);
    expect(isProjectFileName("part.json")).toBe(false);
    expect(isProjectFileName("sketchforge")).toBe(false);
  });
});

describe("looksLikeProjectFile", () => {
  it("recognises a legacy project by its envelope, whatever the file is called", () => {
    const bytes = new TextEncoder().encode(legacyFileText({ name: "Renamed", shapes: [] }));
    expect(looksLikeProjectFile(bytes)).toBe(true);
    expect(looksLikeProjectFile(bytes.buffer)).toBe(true);
  });

  it("does not claim .skf packages or other JSON", () => {
    expect(looksLikeProjectFile(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe(false);
    expect(looksLikeProjectFile(new TextEncoder().encode('{"schema":"com.sketchforge.project"}'))).toBe(false);
  });
});

describe("restoredProjectFromLegacyFile", () => {
  it("converts a legacy file into the in-memory shape importSkfProject returns", () => {
    const workspace = { ...DEFAULT_WORKPLANE_WORKSPACE, width: 300 };
    const restored = restoredProjectFromLegacyFile(
      legacyFileText({ name: "Old name", workspace, snapGrid: "0.5 mm", shapes: [groupShape, importedMeshShape] }, 1_752_300_000_000),
      "Bracket v3.sketchforge",
    );
    expect(restored.projectName).toBe("Bracket v3");
    expect(restored.createdAt).toBe(1_752_300_000_000);
    expect(restored.modifiedAt).toBe(1_752_300_000_000);
    expect(restored.workspace.width).toBe(300);
    expect(restored.snapGrid).toBe("0.5 mm");
    expect(restored.shapes.map((shape) => shape.id)).toEqual(["shape-group-1", "shape-mesh-1"]);
    expect(restored.history).toHaveLength(1);
    expect(restored.history[0].shapes).toEqual(restored.shapes);
    expect(restored.historyIndex).toBe(0);
    expect(restored.assets).toEqual([]);
    expect(restored.placementElevation).toBe(0);
    expect(restored.droppedShapeCount).toBe(0);
  });

  it("falls back to the stored name when the file name has no usable stem", () => {
    expect(restoredProjectFromLegacyFile(legacyFileText({ name: "Stored", shapes: [] }), ".sketchforge").projectName).toBe("Stored");
    expect(restoredProjectFromLegacyFile(legacyFileText({ name: "Stored", shapes: [] })).projectName).toBe("Stored");
  });

  it("drops device-local mesh storage references", () => {
    const meshWithStorage = {
      ...importedMeshShape,
      importedMesh: { ...importedMeshShape.importedMesh!, storageResourceId: "mesh-1", assetId: "asset-1" },
    };
    const restored = restoredProjectFromLegacyFile(legacyFileText({ name: "M", shapes: [meshWithStorage] }));
    expect(restored.shapes[0].importedMesh?.storageResourceId).toBeUndefined();
    expect(restored.shapes[0].importedMesh?.assetId).toBeUndefined();
    expect(restored.shapes[0].importedMesh?.positions).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  });

  it("can be saved as .skf and reopened with the same shapes", async () => {
    const restored = restoredProjectFromLegacyFile(
      legacyFileText({ name: "Round trip", snapGrid: "2.0 mm", shapes: [groupShape, importedMeshShape] }),
      "Round trip.sketchforge.json",
    );
    const bytes = await exportSkfProject({
      projectName: restored.projectName,
      createdAt: restored.createdAt,
      modifiedAt: restored.modifiedAt,
      shapes: restored.shapes,
      history: restored.history,
      historyIndex: restored.historyIndex,
      assets: restored.assets,
      workspace: restored.workspace,
      snapGrid: restored.snapGrid,
      placementElevation: restored.placementElevation,
      placementWorkplane: restored.placementWorkplane,
      sketchPlacementWorkplane: restored.sketchPlacementWorkplane,
    });
    const reopened = await importSkfProject(bytes);
    expect(reopened.projectName).toBe("Round trip");
    expect(reopened.snapGrid).toBe("2.0 mm");
    expect(reopened.shapes.map((shape) => shape.id)).toEqual(["shape-group-1", "shape-mesh-1"]);
    expect(reopened.shapes[0].groupedShapes?.map((shape) => shape.id)).toEqual(["shape-box-1", "shape-cyl-1"]);
    expect(reopened.shapes[0].groupedShapes?.[1].hole).toBe(true);
    expect(reopened.shapes[1].importedMesh?.positions).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  });
});

describe("projectFileNameStem", () => {
  it("strips either legacy extension", () => {
    expect(projectFileNameStem("Gear.sketchforge")).toBe("Gear");
    expect(projectFileNameStem("Gear.SKETCHFORGE.json")).toBe("Gear");
    expect(projectFileNameStem("Gear.skf")).toBe("Gear.skf");
  });
});
