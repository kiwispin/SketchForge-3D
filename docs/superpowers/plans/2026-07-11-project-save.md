# Project Save & Open Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Save any SketchForge project to a `.sketchforge` JSON file on disk, open such files back as new projects, and show an honest autosave indicator in the editor.

**Architecture:** A new pure module `apps/web/src/lib/projectFile.ts` owns serialization/parsing/validation of the project file format (version 1). The editor wires a "Save project" button and Cmd/Ctrl+S into the existing `downloadTextFile()` pipeline (which already handles browser downloads and classroom folder-mode writes). Opening always creates a *new* dashboard project — the dashboard file input and the editor import drop zone both accept `.sketchforge`, funneling into one new handler in `page.tsx`. The autosave indicator surfaces the real IndexedDB write-queue state that `page.tsx` already manages.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, Vitest (config `tests/vitest.config.ts`, alias `@` → `apps/web/src`). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-11-project-save-design.md`

**Branch:** `feature/project-save` (already created)

**Verify commands:**
- Unit tests: `npm run test` (or a single file: `npx vitest run --config tests/vitest.config.ts tests/unit/projectFile.test.ts`)
- Typecheck: `npm run typecheck`
- Both: `npm run ci`
- NOTE: if `npm` fails with EACCES on `/Users/crayner_1/...`, prefix commands with `npm_config_cache=/tmp/npm-cache` (the user's global npmrc points at a dead path; test/typecheck don't normally touch the cache).

---

## Codebase orientation (read once before starting)

| Thing | Where | Why it matters |
| --- | --- | --- |
| `WorkplaneShape` type | `apps/web/src/types/sketchforge.ts:132` | Fully JSON-serializable scene shape (meshes as `number[]`, B-Rep as STEP text, nested `groupedShapes`) |
| `sceneShape()` | `apps/web/src/lib/shapeCatalog.ts:21` | Fills defaults for a partial shape; used by clipboard paste for validation — we reuse it for file parsing |
| `canonicalizeShape()` | `apps/web/src/lib/workplaneShapes.ts:109` | Normalizes rotations/mirrors recursively |
| `normalizeWorkspaceSettings` / `normalizeSnapGrid` | `apps/web/src/lib/workplaneSettings.ts:40-62` | Field-by-field defaulting of workspace settings; no clamping |
| `projectExportFileName()` | `apps/web/src/lib/exportNames.ts` | Filename sanitizer used by STL/OBJ/STEP exports; Task 1 extracts its stem logic for reuse |
| `downloadTextFile()` | `apps/web/src/components/SketchForgeEditor.tsx` (search `async function downloadTextFile`) | The download rail: browser download or POST to `/api/local-download` in folder mode. Returns `DownloadResult` (`{mode:"browser"} \| {mode:"folder", path}`) |
| `parseClipboardShapes()` | `SketchForgeEditor.tsx` (search `function parseClipboardShapes`) | The existing loose-validation pattern for deserializing shapes |
| Editor keyboard shortcuts | `SketchForgeEditor.tsx` (search `const handleKeyDown = (event: KeyboardEvent)` — the second match, in the big `useEffect`) | Cmd+S goes here |
| `TopActionPanel` | `SketchForgeEditor.tsx` (search `function TopActionPanel`) | Export/Import panel UI; Save button goes in its `panel === "export"` body |
| `SecondaryToolbar` Output section | `SketchForgeEditor.tsx` (search `className="toolbar-section-label">Output`) | Autosave indicator renders here |
| `updateProjectShapes` | `apps/web/src/app/page.tsx` (search `const updateProjectShapes`) | The real IndexedDB autosave queue; indicator state hooks in here |
| `importFileFromDashboard` | `page.tsx` (search `const importFileFromDashboard`) | Existing "file → new project" flow to extend |
| `newProject()` | `page.tsx` (search `function newProject`) | Project factory |

Line numbers below are from the state of the code at plan time — **always locate by the search anchor given in each step**, not the line number.

---

### Task 1: `projectFile.ts` — file format module (TDD)

**Files:**
- Create: `tests/unit/projectFile.test.ts`
- Create: `apps/web/src/lib/projectFile.ts`
- Modify: `apps/web/src/lib/exportNames.ts` (extract shared filename stem helper)

- [ ] **Step 1.1: Write the failing test**

Create `tests/unit/projectFile.test.ts` with exactly:

```ts
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
```

- [ ] **Step 1.2: Run the test to verify it fails**

Run: `npx vitest run --config tests/vitest.config.ts tests/unit/projectFile.test.ts`
Expected: FAIL — `Cannot find module '@/lib/projectFile'` (or equivalent resolve error).

- [ ] **Step 1.3: Extract the filename stem helper in `exportNames.ts`**

Replace the entire contents of `apps/web/src/lib/exportNames.ts` with:

```ts
export type ProjectExportFormat = "stl" | "obj" | "step";

export function projectFileStem(projectName: string) {
  return projectName
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .slice(0, 120);
}

export function projectExportFileName(projectName: string, format: ProjectExportFormat) {
  const safeProjectName = projectFileStem(projectName);
  return `${safeProjectName || "SketchForge design"}.${format}`;
}
```

(This is a pure extraction — `projectExportFileName` behavior is unchanged and its existing tests in `tests/unit/exportNames.test.ts` must still pass.)

- [ ] **Step 1.4: Implement `projectFile.ts`**

Create `apps/web/src/lib/projectFile.ts` with exactly:

```ts
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
```

- [ ] **Step 1.5: Run the new tests — verify they pass**

Run: `npx vitest run --config tests/vitest.config.ts tests/unit/projectFile.test.ts`
Expected: PASS (all tests).

- [ ] **Step 1.6: Run the whole unit suite (exportNames refactor must not break anything)**

Run: `npm run test`
Expected: PASS, including `tests/unit/exportNames.test.ts`.

- [ ] **Step 1.7: Commit**

```bash
git add apps/web/src/lib/projectFile.ts apps/web/src/lib/exportNames.ts tests/unit/projectFile.test.ts
git commit -m "feat: add .sketchforge project file format module"
```

---

### Task 2: Save from the editor — Export panel button + Cmd/Ctrl+S

**Files:**
- Modify: `apps/web/src/components/SketchForgeEditor.tsx`

- [ ] **Step 2.1: Add the import**

In `SketchForgeEditor.tsx`, find the import line `import { projectExportFileName } from "@/lib/exportNames";` and add below it:

```ts
import { projectFileName, serializeProjectFile } from "@/lib/projectFile";
```

- [ ] **Step 2.2: Track the current snap grid in a ref**

The editor top level receives `initialSnap` but the live snap value only passes through `updateProjectWorkspaceSettings`. Find the ref declarations (search `const workspaceSettingsRef = useRef(workspaceSettings);`) and add below it:

```ts
const currentSnapRef = useRef<GridSize>(normalizeSnapGrid(initialSnap));
```

(`normalizeSnapGrid` — confirm it's already imported from `@/lib/workplaneSettings` at the top of the file; add it to that import if not.)

Then find `const updateProjectWorkspaceSettings = useCallback(` and inside it, directly after `setWorkspaceSettings(settings.workspace);`, add:

```ts
currentSnapRef.current = settings.snap;
```

Then find the `useEffect` whose dependency array is `[initialSnap]` (search `}, [initialSnap]);`) — regardless of which one you find first, add a separate small effect next to the other effects near it:

```ts
useEffect(() => {
  currentSnapRef.current = normalizeSnapGrid(initialSnap);
}, [initialSnap]);
```

- [ ] **Step 2.3: Replace the dead `saveDesign` with a real file save**

Find `const saveDesign = useCallback(() => {` (it only sets a fake notice and is referenced nowhere). Replace the whole `saveDesign` declaration with:

```ts
const saveProjectToFile = useCallback(() => {
  const fileName = projectFileName(projectName);
  const content = serializeProjectFile({
    name: projectName,
    workspace: workspaceSettingsRef.current,
    snapGrid: currentSnapRef.current,
    shapes: shapesRef.current,
  });
  void downloadTextFile(fileName, content, "application/json")
    .then((result) => {
      setNotice(result.mode === "folder" ? `Saved ${fileName} to ${result.path}` : `Saved ${fileName}`);
    })
    .catch((error: unknown) => {
      setNotice(error instanceof Error ? error.message : "Could not save project file");
    });
  setMenuOpen(false);
}, [projectName]);
```

- [ ] **Step 2.4: Add the button to the Export panel**

Find `function TopActionPanel({` and:

1. Add `onSaveProject,` to the destructured props (after `onExportStep,`).
2. Add `onSaveProject: () => void;` to the prop types (after `onExportStep: () => void;`).
3. In the JSX, find `{panel === "export" ? (` and replace the export body block with:

```tsx
{panel === "export" ? (
  <div className="top-action-body">
    <button onClick={onSaveProject}>
      <Download size={18} />
      Save project (.sketchforge)
    </button>
    <p className="export-step-note">Project files reopen in SketchForge with editable shapes, groups, holes, and workspace settings.</p>
    <p>{shapeCount} {scopeLabel} solid shape{shapeCount === 1 ? "" : "s"} ready to export.</p>
    <button onClick={() => onExport("stl")}>
      <Download size={18} />
      Download STL
    </button>
    <button onClick={() => onExport("obj")}>
      <ToolbarExportIcon />
      Download OBJ
    </button>
    <button onClick={onExportStep} disabled={stepExporting}>
      <ToolbarExportIcon />
      {stepExporting ? "Building STEP…" : "Download STEP (B-Rep)"}
    </button>
    <p className="export-step-note">STEP keeps boxes, cylinders, spheres and cones as exact CAD geometry (OpenCascade). Other shapes are skipped.</p>
  </div>
) : null}
```

4. Find the `<TopActionPanel` invocation (search `onExportStep={exportStepDesign}`) and add below that line:

```tsx
onSaveProject={saveProjectToFile}
```

- [ ] **Step 2.5: Add Cmd/Ctrl+S**

In the main keyboard `useEffect` (search `const handleKeyDown = (event: KeyboardEvent)`, the one containing `if (shortcut && key === "g")`), find this block:

```ts
if (shortcut && key === "h") {
  event.preventDefault();
  if (event.shiftKey) {
    showHidden();
  } else {
    toggleHidden();
  }
  return;
}
```

and add directly after it:

```ts
if (shortcut && key === "s") {
  event.preventDefault();
  saveProjectToFile();
  return;
}
```

**Placement matters:** it must be in the `shortcut &&` group *before* the bare `key === "s"` branch near the bottom (which sets solid mode). Then add `saveProjectToFile,` to that effect's dependency array (the long list right after `window.removeEventListener("keydown", handleKeyDown);`).

- [ ] **Step 2.6: Typecheck**

Run: `npm run typecheck`
Expected: clean. (Watch for: unused `Download` import — it's already used by the STL button; and any leftover reference to `saveDesign` — there should be none.)

- [ ] **Step 2.7: Commit**

```bash
git add apps/web/src/components/SketchForgeEditor.tsx
git commit -m "feat: save project as .sketchforge from export panel and Cmd+S"
```

---

### Task 3: Open `.sketchforge` files as new projects

**Files:**
- Modify: `apps/web/src/components/SketchForgeEditor.tsx` (accept project files in import path, new prop)
- Modify: `apps/web/src/app/page.tsx` (project creation from parsed payload, dashboard accept, card label)

- [ ] **Step 3.1: Extend the editor import path**

In `SketchForgeEditor.tsx`:

1. Extend the Task 2 import to:

```ts
import { isProjectFileName, parseProjectFile, projectFileName, serializeProjectFile, type ParsedProjectFile } from "@/lib/projectFile";
```

2. Add the new prop. Find the `export function SketchForgeEditor({` signature and add `onProjectFileImport,` after `onProjectWorkspaceChange,` in the destructuring, and after the `onProjectWorkspaceChange?: ...;` type line add:

```ts
onProjectFileImport?: (payload: ParsedProjectFile) => void;
```

3. Find `const selectFile = useCallback(async (file: File) => {` and insert at the very top of its body (before `const isStep = ...`):

```ts
if (isProjectFileName(file.name)) {
  if (!onProjectFileImport) {
    setNotice("Open project files from the dashboard");
    return;
  }
  try {
    const parsed = parseProjectFile(await file.text());
    onProjectFileImport(parsed);
    setTopPanel(null);
  } catch (error) {
    setNotice(error instanceof Error ? error.message : `Could not open ${file.name}`);
  }
  return;
}
```

Add `onProjectFileImport` to `selectFile`'s dependency array (currently `[commitShapes, shapes]`).

4. Find the hidden import input (search `accept=".stl,.step,.stp,.svg,image/svg+xml"`) and change it to:

```
accept=".stl,.step,.stp,.svg,image/svg+xml,.sketchforge"
```

5. In `TopActionPanel`'s import body, change the drop-zone copy:

```tsx
<strong>Drop STL, STEP, SVG, or .sketchforge files</strong>
```

and the unsupported-type notice inside `selectFile` from `"Unsupported file type. Use STL, STEP, or SVG."` to:

```ts
setNotice("Unsupported file type. Use STL, STEP, SVG, or .sketchforge.");
```

- [ ] **Step 3.2: Add the project-payload import handler in `page.tsx`**

In `apps/web/src/app/page.tsx`:

1. Add to the imports from the editor module — find:

```ts
import { SketchForgeEditor, importedShapeFromStl, importedShapeFromSvg } from "@/components/SketchForgeEditor";
```

and add below it:

```ts
import { isProjectFileName, parseProjectFile, type ParsedProjectFile } from "@/lib/projectFile";
```

2. Find `const importFileFromDashboard = useCallback(` and insert this new callback *directly above* it:

```ts
const importProjectFilePayload = useCallback(
  (payload: ParsedProjectFile, sourceName?: string) => {
    const takenNames = new Set(projects.map((project) => project.name));
    let name = payload.name;
    for (let suffix = 2; takenNames.has(name); suffix += 1) {
      name = `${payload.name} (${suffix})`;
    }
    const project = newProject(name, projects.length, payload.shapes.length);
    project.workspace = payload.workspace;
    project.snapGrid = payload.snapGrid;
    const revision = project.revision ?? project.updatedAt;
    setProjectShapesById((current) => ({
      ...current,
      [project.id]: { revision, shapes: payload.shapes },
    }));
    void saveProjectShapes(project.id, payload.shapes, revision).catch(() => {
      setDashboardNotice("Could not prepare project shape storage");
    });
    const droppedNote =
      payload.droppedShapeCount > 0
        ? ` (skipped ${payload.droppedShapeCount} unreadable shape${payload.droppedShapeCount === 1 ? "" : "s"})`
        : "";
    setDashboardNotice(`Imported ${sourceName ?? name}${droppedNote}`);
    setProjects((current) => [project, ...current]);
    openEditor(project.id, { allowMissingFromStorage: true });
  },
  [projects],
);
```

(Matches the existing `importFileFromDashboard` pattern, including its tolerance of `openEditor` being a plain function.)

3. In `importFileFromDashboard`, insert at the top of the `async (file: File) => {` body (before the `const isSvg = ...` line):

```ts
if (isProjectFileName(file.name)) {
  try {
    importProjectFilePayload(parseProjectFile(await file.text()), file.name);
  } catch (error) {
    setDashboardNotice(error instanceof Error ? error.message : `Could not open ${file.name}`);
  }
  return;
}
```

and add `importProjectFilePayload` to its dependency array (currently `[projects.length]`).

4. Find the dashboard file input (search `accept=".stl,.svg,image/svg+xml"`) and change it to:

```
accept=".stl,.svg,image/svg+xml,.sketchforge"
```

5. Find the dashboard card label `<span>Import STL/SVG</span>` and change it to:

```tsx
<span>Import file</span>
```

6. Find the `<SketchForgeEditor` invocation and add after `onProjectWorkspaceChange={updateProjectWorkspace}`:

```tsx
onProjectFileImport={importProjectFilePayload}
```

- [ ] **Step 3.3: Typecheck + unit suite**

Run: `npm run ci`
Expected: clean typecheck, all tests pass.

- [ ] **Step 3.4: Commit**

```bash
git add apps/web/src/components/SketchForgeEditor.tsx apps/web/src/app/page.tsx
git commit -m "feat: open .sketchforge files as new projects from dashboard and editor"
```

---

### Task 4: Autosave indicator in the editor ribbon

**Files:**
- Modify: `apps/web/src/types/sketchforge.ts` (status type)
- Modify: `apps/web/src/app/page.tsx` (track write-queue state)
- Modify: `apps/web/src/components/SketchForgeEditor.tsx` (prop + render)
- Modify: `apps/web/src/app/globals.css` (indicator style)

- [ ] **Step 4.1: Add the status type**

In `apps/web/src/types/sketchforge.ts`, add after the `GridSize` type declaration:

```ts
export type ProjectSaveStatus = "idle" | "saving" | "saved" | "error";
```

- [ ] **Step 4.2: Track save status in `page.tsx`**

1. Add `ProjectSaveStatus` to the type import from `@/types/sketchforge`.
2. Find the state declarations in `Home()` (search `const [projectShapesById, setProjectShapesById]`) and add below:

```ts
const [projectSaveStatus, setProjectSaveStatus] = useState<ProjectSaveStatus>("idle");
const pendingProjectSavesRef = useRef(0);
```

3. Replace the entire `const updateProjectShapes = useCallback(...)` with:

```ts
const updateProjectShapes = useCallback((snapshot: { projectId: string; shapes: WorkplaneShape[] }) => {
  const revision = Math.max(Date.now(), nextProjectRevisionRef.current + 1);
  nextProjectRevisionRef.current = revision;
  setProjectShapesById((current) => {
    const existing = current[snapshot.projectId];
    if (existing && existing.revision > revision) {
      return current;
    }
    return {
      ...current,
      [snapshot.projectId]: { revision, shapes: snapshot.shapes },
    };
  });

  pendingProjectSavesRef.current += 1;
  setProjectSaveStatus("saving");
  const previousSave = projectShapeSaveQueuesRef.current[snapshot.projectId] ?? Promise.resolve();
  const queuedSave = previousSave.catch(() => undefined).then(() => saveProjectShapes(snapshot.projectId, snapshot.shapes, revision));
  projectShapeSaveQueuesRef.current[snapshot.projectId] = queuedSave;

  void queuedSave
    .then(() => {
      pendingProjectSavesRef.current -= 1;
      if (pendingProjectSavesRef.current === 0) {
        setProjectSaveStatus("saved");
      }
      setProjects((current) =>
        current.map((project) =>
          project.id === snapshot.projectId && (project.revision ?? 0) <= revision
            ? { ...project, shapes: snapshot.shapes.length, updatedAt: revision, revision }
            : project,
        ),
      );
    })
    .catch((error) => {
      pendingProjectSavesRef.current -= 1;
      setProjectSaveStatus("error");
      if (projectShapeSaveQueuesRef.current[snapshot.projectId] === queuedSave) {
        setDashboardNotice(error instanceof Error ? error.message : "Could not save project shapes");
      }
    })
    .finally(() => {
      if (projectShapeSaveQueuesRef.current[snapshot.projectId] === queuedSave) {
        delete projectShapeSaveQueuesRef.current[snapshot.projectId];
      }
    });
}, []);
```

(The only changes from the original are the `pendingProjectSavesRef` counter and the two `setProjectSaveStatus` calls; everything else is byte-identical.)

4. In the `<SketchForgeEditor` invocation, add after `projectRevision={...}`:

```tsx
saveStatus={activeProjectId ? projectSaveStatus : null}
```

- [ ] **Step 4.3: Accept and render the status in the editor**

In `SketchForgeEditor.tsx`:

1. Add `ProjectSaveStatus` to the type import from `@/types/sketchforge`.
2. Add the prop to `SketchForgeEditor`: `saveStatus = null,` in the destructuring and

```ts
saveStatus?: ProjectSaveStatus | null;
```

in the prop types.

3. Pass it through to `SecondaryToolbar`: in the `<SecondaryToolbar` invocation (search `onTopPanel={(panel) => {`), add above `onTopPanel`:

```tsx
saveStatus={saveStatus}
```

4. In `function SecondaryToolbar({`, add `saveStatus,` to the destructuring (after `onAddShape,`) and

```ts
saveStatus?: ProjectSaveStatus | null;
```

to its prop types.

5. Find the Output section (search `className="toolbar-section-label">Output`) and change the section to render the indicator as the first child of `action-buttons`:

```tsx
<div className="toolbar-section toolbar-actions-section">
  <div className="toolbar-section-label">Output</div>
  <div className="action-buttons">
    {saveStatus && saveStatus !== "idle" ? (
      <div className={`autosave-indicator ${saveStatus}`} role="status" title="Designs autosave to this browser">
        {saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "Saved ✓" : "Save failed"}
      </div>
    ) : null}
    <button className="action-icon-button" aria-label="Import" title="Import" onClick={() => onTopPanel("import")}>
      <ToolbarImportIcon />
    </button>
    <button className="action-icon-button" aria-label="Export" title="Export" onClick={() => onTopPanel("export")}>
      <ToolbarVectorExportIcon />
    </button>
    <button className="action-icon-button" aria-label="Workspace settings" title="Workspace settings" onClick={() => window.dispatchEvent(new Event("sketchforge:open-workspace-settings"))}>
      <ToolbarSettingsIcon />
    </button>
  </div>
</div>
```

- [ ] **Step 4.4: Style the indicator**

In `apps/web/src/app/globals.css`, find the `.toolbar-actions-section {` rule (around line 1723) and add after that rule block:

```css
.autosave-indicator {
  align-self: center;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
  color: #64748b;
  padding: 0 6px;
}

.autosave-indicator.saving {
  color: #2563eb;
}

.autosave-indicator.error {
  color: #dc2626;
}
```

- [ ] **Step 4.5: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4.6: Commit**

```bash
git add apps/web/src/types/sketchforge.ts apps/web/src/app/page.tsx apps/web/src/components/SketchForgeEditor.tsx apps/web/src/app/globals.css
git commit -m "feat: show real autosave status in the editor ribbon"
```

---

### Task 5: Full verification (automated + manual)

**Files:** none new — fixes only if verification fails.

- [ ] **Step 5.1: Full CI**

Run: `npm run ci`
Expected: typecheck clean, every unit test passes.

- [ ] **Step 5.2: Manual end-to-end in the browser**

With the dev server running (`npm run dev`, port 3000):

1. Create a new design; add a Box; add a Cylinder; mark the Cylinder as Hole; select all; Group. Open workspace settings and change something visible (e.g. grid off). Confirm the ribbon shows "Saving…" then "Saved ✓" while editing.
2. Open OUTPUT → Export → **Save project (.sketchforge)**. Confirm a `.sketchforge` file downloads named after the project.
3. Press **Cmd+S** (or Ctrl+S). Confirm the same save happens and no browser save-page dialog appears.
4. Go Home → **Import file** → choose the downloaded `.sketchforge`. Confirm a NEW project appears (name deduped with " (2)" if needed) and opens with: the grouped cut shape intact (editable group, hole preserved after Ungroup), and the workspace setting change intact.
5. Drag the `.sketchforge` file onto the editor's Import drop zone. Confirm it also creates and opens a new project.
6. Feed it a bogus file (rename any `.txt` to `.sketchforge`). Confirm the friendly "This file isn't a SketchForge project" notice, no crash.

- [ ] **Step 5.3: Fix anything found, re-run, commit fixes**

Any fix gets its own focused commit.

---

## Self-review notes (already applied)

- Spec coverage: format+versioning (Task 1), save via existing pipeline + Cmd+S (Task 2), open-as-new-project from both surfaces + name dedupe + dropped-shape count (Task 3), honest autosave indicator incl. error state (Task 4), tests + manual pass (Tasks 1, 5). Out-of-scope items untouched.
- Type consistency: `ParsedProjectFile` produced by Task 1, consumed by Tasks 2–3 (`onProjectFileImport`, `importProjectFilePayload`); `ProjectSaveStatus` defined once in `types/sketchforge.ts` and imported by both `page.tsx` and the editor.
- The `exportNames.ts` change is a pure extraction; existing tests guard it.
