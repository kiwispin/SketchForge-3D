# Project Save & Open — Design

**Date:** 2026-07-11
**Status:** Approved by user (pre-implementation)

## Problem

SketchForge autosaves silently to browser storage (shape data to IndexedDB via
`updateProjectShapes` in `apps/web/src/app/page.tsx`; project metadata to
localStorage), but:

- There is no way to save a project as a file on disk. Exports (STL/OBJ/STEP)
  lose the editable structure: solid/hole flags, groups, colors, sketches,
  edge-treatment history, workspace settings.
- There is no way to load a project back in. Import accepts only STL/STEP/SVG
  geometry. Clearing browser data loses all projects permanently.
- Nothing in the editor tells the user their work is being saved, so the app
  appears to have no save at all.

## Decisions (agreed with user)

1. **Scope:** Both file save/open on disk **and** a visible autosave indicator.
2. **Open behavior:** Opening a project file always **imports it as a new
   project** in the dashboard. It never overwrites or merges into an existing
   project.
3. **File extension:** `.sketchforge` (JSON content). The open path also
   accepts `.sketchforge.json`.
4. **Mechanism:** Reuse the existing download pipeline (`downloadTextFile()`,
   which honors the browser-download vs. server-folder setting and works in
   static-export builds). No File System Access API in this iteration, but the
   serialization/parsing lives in its own module so a file-handle backend can
   be added later without UI changes.

## File format

```json
{
  "format": "sketchforge-project",
  "version": 1,
  "savedAt": 1752192000000,
  "app": { "name": "SketchForge", "version": "0.5.0" },
  "project": {
    "name": "My design",
    "workspace": { "...": "WorkplaneWorkspaceSettings" },
    "snapGrid": "1.0 mm",
    "shapes": [ { "...": "WorkplaneShape[]" } ]
  }
}
```

- `WorkplaneShape` (see `apps/web/src/types/sketchforge.ts`) is already fully
  JSON-serializable: mesh positions as `number[]`, B-Rep as STEP text strings,
  images as data URLs, nested `groupedShapes`.
- `format` must equal `"sketchforge-project"`; anything else → "This file
  isn't a SketchForge project."
- `version` greater than the supported version → "This project was made with a
  newer version of SketchForge."
- On load, `workspace` and `snapGrid` are normalized with the existing
  `normalizeWorkspaceSettings` / `normalizeSnapGrid` helpers; missing values
  fall back to defaults.
- Malformed entries in `shapes` are dropped individually (with a count
  reported in the notice) instead of failing the whole import.

## Components

### 1. `apps/web/src/lib/projectFile.ts` (new)

Single-purpose module; no React, no DOM.

- `PROJECT_FILE_VERSION = 1`, `PROJECT_FILE_FORMAT = "sketchforge-project"`
- `serializeProjectFile({ name, workspace, snapGrid, shapes }): string`
- `parseProjectFile(text: string): { name: string; workspace?: WorkplaneWorkspaceSettings; snapGrid?: GridSize; shapes: WorkplaneShape[]; droppedShapeCount: number }`
  — throws `Error` with user-facing message on invalid input
- `projectFileName(projectName: string): string` — sanitizes like
  `exportNames.ts` and appends `.sketchforge`
- `isProjectFileName(fileName: string): boolean` — matches `.sketchforge` and
  `.sketchforge.json` (case-insensitive)

### 2. Save UI (editor)

- The OUTPUT → Export panel gains a **"Save project (.sketchforge)"** button
  above the STL/OBJ/STEP buttons. It serializes the current project (name,
  workspace, snap grid, all shapes — not just selection) and calls
  `downloadTextFile()`.
- **Cmd/Ctrl+S** in the editor triggers the same save with `preventDefault()`.
- Success shows the existing status toast, e.g. `Saved My design.sketchforge`
  (folder mode shows the written path, matching current export behavior).

### 3. Open UI

- **Dashboard:** the "Import STL/SVG" card becomes **"Import file"** and its
  file input / drag-drop accepts `.sketchforge` in addition to STL/SVG. A
  project file creates a new dashboard project using the file's saved name
  (deduped with " (2)" style suffixes if taken), workspace settings, snap
  grid, and shapes, then opens the editor on it.
- **Editor:** the Import drop zone / file picker also accepts `.sketchforge`.
  Same rule — a new project is created and opened; the currently open project
  is left untouched. This flows through a new callback prop from `page.tsx`
  (which owns project creation).

### 4. Autosave indicator (editor)

- `page.tsx` already queues IndexedDB writes per project in
  `updateProjectShapes`. Track that queue's state as
  `"idle" | "saving" | "saved" | "error"` and pass it into
  `SketchForgeEditor` as a prop.
- The editor ribbon shows a small, unobtrusive indicator (near the OUTPUT
  group): "Saving…" while a write is in flight, "Saved ✓" once settled, red
  "Save failed" on rejection. Hidden when the editor has no `projectId`.
- The indicator reflects real write promises — no fake timers.

## Error handling

| Case | Behavior |
| --- | --- |
| Non-JSON / wrong `format` | Notice: "This file isn't a SketchForge project" |
| `version` > supported | Notice: "This project was made with a newer version of SketchForge" |
| Some shapes malformed | Import succeeds; notice includes dropped count |
| IndexedDB write fails | Indicator shows "Save failed" in editor (today the error is only a dashboard notice the user cannot see) |
| Folder-mode write fails | Same error path as existing exports |

## Testing

- **Unit:** `tests/unit/projectFile.test.ts` — round-trip fidelity (including
  grouped shapes, holes, imported meshes, sketch profiles), format/version
  rejection, malformed-shape dropping, filename sanitization, extension
  matching.
- **Suite:** `npm run ci` (typecheck + all unit tests) must pass.
- **Manual:** in the running app — build a scene with a group, a hole, and a
  changed workspace setting; save; reimport; verify identical scene and
  settings. Verify Cmd+S, the autosave indicator states, and dashboard import
  of the same file.

## Out of scope

- File System Access API (in-place re-save) — future enhancement.
- Merging a project file into an existing project.
- Any change to the STL/OBJ/STEP export formats.
- Cloud/server-side project storage.
