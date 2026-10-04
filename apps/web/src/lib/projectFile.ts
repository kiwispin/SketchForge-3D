// Read-only importer for the fork's legacy `.sketchforge` project files.
//
// Earlier SketchForge builds saved projects as a small JSON envelope
// (`{ format: "sketchforge-project", version: 1, project: {...} }`). The
// packaged `.skf` format (lib/skfProject.ts) is now the only format SketchForge
// writes; this module only reads the legacy files and converts them into the
// same in-memory shape `importSkfProject` returns, so an opened legacy file
// behaves like any other project and is saved again as `.skf`.

import { editorHistoryEntry } from "@/lib/editorHistory";
import { horizontalPlacementWorkplane } from "@/lib/placementWorkplane";
import { sceneShape } from "@/lib/shapeCatalog";
import type { SkfRestoredProject } from "@/lib/skfProject";
import { normalizeSnapGrid, normalizeWorkspaceSettings } from "@/lib/workplaneSettings";
import type { GridSize, ShapeKind, WorkplaneShape, WorkplaneWorkspaceSettings } from "@/types/sketchforge";

export const PROJECT_FILE_FORMAT = "sketchforge-project";
export const PROJECT_FILE_VERSION = 1;
export const PROJECT_FILE_EXTENSION = ".sketchforge";

const INVALID_PROJECT_FILE_MESSAGE = "This file isn't a SketchForge project";
const NEWER_VERSION_MESSAGE = "This project was made with a newer version of SketchForge";

export type ParsedProjectFile = {
  name: string;
  savedAt: number | null;
  workspace: WorkplaneWorkspaceSettings;
  snapGrid: GridSize;
  shapes: WorkplaneShape[];
  droppedShapeCount: number;
};

export function isProjectFileName(fileName: string) {
  return /\.sketchforge(\.json)?$/i.test(fileName.trim());
}

// Legacy files always start with the format field, so a cheap prefix check is
// enough to recognise one that was renamed (for example to `.skf`).
export function looksLikeProjectFile(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const prefix = new TextDecoder().decode(view.subarray(0, Math.min(view.byteLength, 128))).trimStart();
  return /^\{\s*"format"\s*:\s*"sketchforge-project"/.test(prefix);
}

// Imported meshes in legacy files carry their geometry inline; drop references
// to storage records or asset tables that only existed on the saving device.
function withoutForeignResourceReferences(shape: WorkplaneShape): WorkplaneShape {
  const next: WorkplaneShape = { ...shape };
  if (next.importedMesh) {
    const { storageResourceId: _storage, assetId: _asset, ...mesh } = next.importedMesh;
    void _storage;
    void _asset;
    next.importedMesh = mesh;
  }
  if (next.groupedShapes) {
    next.groupedShapes = next.groupedShapes.map(withoutForeignResourceReferences);
  }
  return next;
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
  const file = raw as { format?: unknown; version?: unknown; savedAt?: unknown; project?: unknown };
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
    // defaults for anything missing and canonicalizes rotations. Malformed
    // nested content (e.g. bad groupedShapes) throws inside sceneShape, so
    // treat any throw as a malformed entry and drop it.
    try {
      return [withoutForeignResourceReferences(sceneShape({ ...shape, name: shape.name, kind: shape.kind as ShapeKind, color: shape.color }))];
    } catch {
      droppedShapeCount += 1;
      return [];
    }
  });

  const name = typeof project.name === "string" && project.name.trim() ? project.name.trim() : "Imported design";
  const savedAt = typeof file.savedAt === "number" && Number.isFinite(file.savedAt) && file.savedAt > 0 ? file.savedAt : null;
  return {
    name,
    savedAt,
    workspace: normalizeWorkspaceSettings(project.workspace),
    snapGrid: normalizeSnapGrid(project.snapGrid),
    shapes,
    droppedShapeCount,
  };
}

// The file's own name is what the student sees on disk or in Drive, so it wins
// over the (possibly stale) name stored inside the project.
export function projectFileNameStem(fileName: string) {
  return fileName.replace(/\.sketchforge(\.json)?$/i, "").trim();
}

export type LegacyRestoredProject = SkfRestoredProject & { droppedShapeCount: number };

// Converts a legacy file into the in-memory project shape that upstream's
// open-project code expects from importSkfProject: a single history state,
// no packaged assets (meshes are inline) and the base workplane.
export function restoredProjectFromLegacyFile(text: string, fileName?: string, now = Date.now()): LegacyRestoredProject {
  const parsed = parseProjectFile(text);
  const timestamp = parsed.savedAt ?? now;
  const placementWorkplane = horizontalPlacementWorkplane();
  return {
    projectName: (fileName && isProjectFileName(fileName) ? projectFileNameStem(fileName) : "") || parsed.name,
    createdAt: timestamp,
    modifiedAt: timestamp,
    shapes: parsed.shapes,
    history: [editorHistoryEntry(parsed.shapes, [])],
    historyIndex: 0,
    assets: [],
    workspace: parsed.workspace,
    snapGrid: parsed.snapGrid,
    placementElevation: 0,
    placementWorkplane,
    sketchPlacementWorkplane: horizontalPlacementWorkplane(),
    droppedShapeCount: parsed.droppedShapeCount,
  };
}
