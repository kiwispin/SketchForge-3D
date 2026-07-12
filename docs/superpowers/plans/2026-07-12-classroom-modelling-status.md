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

### ✅ 1. Ruler and exact placement — COMPLETE

- The existing workplane ruler and exact dimension inputs were retained.
- Added editable **X**, **Y**, and **Z** fields to the selected-shape inspector, using the active measurement unit.
- Verification: created a Box, set X/Z and Y = 6 mm, confirmed all values commit correctly; the Ruler control remains present. Typecheck and all 50 unit tests pass.

### 🔶 2. Duplicate and repeat — IN PROGRESS

- Planned behaviour: duplicate the selected shape(s) repeatedly with a configurable count and X/Y/Z spacing, retaining all existing shape properties.

### ⬜ 3. Align and distribute — NOT STARTED

### ⬜ 4. Categorized shape library — NOT STARTED

### ⬜ 5. Guided activities — NOT STARTED

### ⬜ 6. Printability preflight — NOT STARTED

### ⬜ Final verification — NOT STARTED

- Run `npm run ci`, `npm run pages:build`, and a live GitHub Pages smoke test after the final feature.
