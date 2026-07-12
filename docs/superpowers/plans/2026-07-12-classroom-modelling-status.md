# Classroom Modelling Pack — Plan & Execution Status

**Started:** 2026-07-12  
**Branch:** `main`  
**Goal:** Make SketchForge as approachable for classroom 3D design as the best parts of Tinkercad, while preserving its offline-first, local-project workflow.

## Approved delivery order

1. **Ruler and exact placement** — complete editable X/Y/Z placement for selected shapes, alongside the existing workplane ruler and dimension fields.
2. **Duplicate and repeat** — duplicate a selection repeatedly with a controlled offset, producing simple arrays/patterns.
3. **Align and distribute** — extend the existing alignment tools with evenly spaced distribution.
4. **Categorized shape library** — add useful classroom categories: Basic, Text, Connectors, Architectural, and Printable Parts.
5. **Guided activities** — provide in-app, offline-friendly activities for a name tag, dice, and phone stand.
6. **Printability preflight** — flag common STL-printing problems before export: tiny dimensions, floating shapes, and workspace-boundary issues.

## Guardrails

- Each item is implemented, tested, and recorded here before work begins on the next item.
- All core student work remains local/offline-capable; no student account is required.
- Existing `.sketchforge`, STL, OBJ, and STEP workflows must remain compatible.
- We borrow interaction patterns, not Tinkercad branding, assets, or code.

## Execution log

### ✅ 1. Ruler and exact placement — IMPLEMENTED AND INTERACTION-TESTED

- The existing workplane ruler and exact dimension inputs were retained.
- Added editable **X**, **Y**, and **Z** fields to the selected-shape inspector, using the active measurement unit.
- Fixed the ruler so its controls are discoverable and usable: visible **Undo ruler** and **Clear ruler** controls, plus Cmd/Ctrl+Z support for ruler history. Ruler points can be dragged with the primary pointer.
- Verified in the running app: created a ruler segment, used both the **Undo ruler** button and Cmd/Ctrl+Z (each removed the segment), dragged the remaining point, and used **Clear ruler**.
- Fixed and re-verified the main toolbar **Undo**: it now enables whenever ruler history exists and removes the latest ruler action, matching Cmd/Ctrl+Z.
- Verified editable X/Y/Z placement in the running app with X = 24 mm, Y = 6 mm, and Z = -18 mm.

### ✅ 2. Duplicate and repeat — IMPLEMENTED AND INTERACTION-TESTED

- Kept the existing one-click Duplicate and Cmd/Ctrl+D behaviour.
- Added **Repeat…** beside Duplicate. Students choose 1–50 copies and X/Y/Z offsets.
- Verified in the running app: repeated one selected Box twice using X = 5 mm, Y = 3 mm, and Z = -7 mm offsets. The resulting positions were (10, 2, -5), (15, 5, -12), and (20, 8, -19) mm. The earlier 3-copy X-offset path was also exercised.

### ✅ 3. Align and distribute — IMPLEMENTED AND INTERACTION-TESTED

- Existing min/centre/max alignment controls remain unchanged.
- Added **Distribute X** and **Distribute Z** controls for three or more selected shapes. End shapes remain fixed; unlocked shapes between them are spaced evenly.
- Verified in the running app with unevenly placed shapes: **Distribute X** changed X positions from 0, 45, 100 to 0, 50, 100 mm; **Distribute Z** changed Z positions from 0, 50, 10 to 0, 50, 25 mm. The controls were enabled only after three shapes were selected.

### 🔶 4. Categorized shape library — IN PROGRESS

- Planned categories: Basic, Text, Connectors, Architectural, and Printable Parts. Existing basic primitives stay available in the first category.

### ⬜ 5. Guided activities — NOT STARTED

### ⬜ 6. Printability preflight — NOT STARTED

### ⬜ Final verification — NOT STARTED

- Run `npm run ci`, `npm run pages:build`, and a live GitHub Pages smoke test after the final feature.
