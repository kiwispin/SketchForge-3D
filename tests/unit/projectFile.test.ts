import { describe, expect, it } from "vitest";
import {
  PROJECT_FILE_FORMAT,
  PROJECT_FILE_VERSION,
  isProjectFileName,
  parseProjectFile,
  projectFileName,
  serializeProjectFile,
} from "@/lib/projectFile";
import { DEFAULT_WORKPLANE_WORKSPACE } from "@/lib/workplaneSettings";
import type { WorkplaneShape } from "@/types/sketchforge";

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

describe("serializeProjectFile / parseProjectFile", () => {
  it("round-trips name, settings, and shapes including groups, holes, and meshes", () => {
    const workspace = { ...DEFAULT_WORKPLANE_WORKSPACE, width: 300, showGrid: false };
    const text = serializeProjectFile({
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

  it("writes the declared format and version envelope", () => {
    const envelope = JSON.parse(serializeProjectFile({ name: "X", shapes: [] })) as {
      format: string;
      version: number;
      savedAt: number;
      project: { name: string };
    };
    expect(envelope.format).toBe(PROJECT_FILE_FORMAT);
    expect(envelope.version).toBe(PROJECT_FILE_VERSION);
    expect(typeof envelope.savedAt).toBe("number");
    expect(envelope.project.name).toBe("X");
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

  it("falls back to a usable project name", () => {
    const text = JSON.stringify({
      format: "sketchforge-project",
      version: 1,
      project: { name: "   ", shapes: [] },
    });
    expect(parseProjectFile(text).name).toBe("Imported design");
  });
});

describe("projectFileName", () => {
  it("uses the sanitized project name with the .sketchforge extension", () => {
    expect(projectFileName("Gearbox Prototype")).toBe("Gearbox Prototype.sketchforge");
    expect(projectFileName("  enclosure: v2 / final?  ")).toBe("enclosure- v2 - final-.sketchforge");
  });

  it("falls back when the name cannot be used", () => {
    expect(projectFileName("...")).toBe("SketchForge design.sketchforge");
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
