import { projectFileStem } from "@/lib/exportNames";
import { sceneShape } from "@/lib/shapeCatalog";
import { normalizeSnapGrid, normalizeWorkspaceSettings } from "@/lib/workplaneSettings";
import { canonicalizeShape } from "@/lib/workplaneShapes";
import type { GridSize, ShapeKind, WorkplaneShape, WorkplaneWorkspaceSettings } from "@/types/sketchforge";

export const PROJECT_FILE_FORMAT = "sketchforge-project";
export const PROJECT_FILE_VERSION = 1;
export const PROJECT_FILE_EXTENSION = ".sketchforge";

// Informational only (never used to gate parsing). Bump alongside package.json.
const APP_VERSION = "0.5.0";

const INVALID_PROJECT_FILE_MESSAGE = "This file isn't a SketchForge project";
const NEWER_VERSION_MESSAGE = "This project was made with a newer version of SketchForge";

export type ProjectFilePayload = {
  name: string;
  workspace?: WorkplaneWorkspaceSettings;
  snapGrid?: GridSize;
  shapes: WorkplaneShape[];
};

export type ParsedProjectFile = {
  name: string;
  workspace: WorkplaneWorkspaceSettings;
  snapGrid: GridSize;
  shapes: WorkplaneShape[];
  droppedShapeCount: number;
};

export function projectFileName(projectName: string) {
  return `${projectFileStem(projectName) || "SketchForge design"}${PROJECT_FILE_EXTENSION}`;
}

export function isProjectFileName(fileName: string) {
  return /\.sketchforge(\.json)?$/i.test(fileName.trim());
}

export function serializeProjectFile(payload: ProjectFilePayload) {
  return JSON.stringify({
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    savedAt: Date.now(),
    app: { name: "SketchForge", version: APP_VERSION },
    project: {
      name: payload.name,
      workspace: normalizeWorkspaceSettings(payload.workspace),
      snapGrid: normalizeSnapGrid(payload.snapGrid),
      shapes: payload.shapes.map(canonicalizeShape),
    },
  });
}

export function parseProjectFile(text: string): ParsedProjectFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(INVALID_PROJECT_FILE_MESSAGE);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(INVALID_PROJECT_FILE_MESSAGE);
  }
  const file = raw as { format?: unknown; version?: unknown; project?: unknown };
  if (file.format !== PROJECT_FILE_FORMAT) {
    throw new Error(INVALID_PROJECT_FILE_MESSAGE);
  }
  if (typeof file.version !== "number" || !Number.isInteger(file.version) || file.version < 1) {
    throw new Error(INVALID_PROJECT_FILE_MESSAGE);
  }
  if (file.version > PROJECT_FILE_VERSION) {
    throw new Error(NEWER_VERSION_MESSAGE);
  }
  const project = file.project as { name?: unknown; workspace?: unknown; snapGrid?: unknown; shapes?: unknown } | null | undefined;
  if (!project || typeof project !== "object" || !Array.isArray(project.shapes)) {
    throw new Error(INVALID_PROJECT_FILE_MESSAGE);
  }

  let droppedShapeCount = 0;
  const shapes = project.shapes.flatMap((entry): WorkplaneShape[] => {
    if (!entry || typeof entry !== "object") {
      droppedShapeCount += 1;
      return [];
    }
    const shape = entry as Partial<WorkplaneShape>;
    if (typeof shape.name !== "string" || typeof shape.kind !== "string" || typeof shape.color !== "string") {
      droppedShapeCount += 1;
      return [];
    }
    // Same loose-but-safe path the shape clipboard uses: sceneShape fills
    // defaults for anything missing, canonicalizeShape normalizes rotations.
    return [canonicalizeShape(sceneShape({ ...shape, name: shape.name, kind: shape.kind as ShapeKind, color: shape.color }))];
  });

  const name = typeof project.name === "string" && project.name.trim() ? project.name.trim() : "Imported design";
  return {
    name,
    workspace: normalizeWorkspaceSettings(project.workspace),
    snapGrid: normalizeSnapGrid(project.snapGrid),
    shapes,
    droppedShapeCount,
  };
}
