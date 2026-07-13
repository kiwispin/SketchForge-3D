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

### 🔶 4. Categorized shape library — BASIC, TEXT, CONNECTORS, AND PRINTABLE PARTS COMPLETE

- Planned categories: Basic, Text, Connectors, Architectural, and Printable Parts. Existing basic primitives stay available in the first category.
- ✅ Added accessible **Basic Shapes** and **Text** category tabs to the Shapes menu. Basic retains Box, Cylinder, Sphere, Cone, Pyramid, Wedge, Round Roof, Half Sphere, Torus, and Tube; Text contains the Text solid.
- ✅ Interaction-tested in the running app: switched between Basic Shapes and Text, added Text, changed its content to `Kia Ora`, selected the Sans font, changed height from 10 to 14 mm, and moved it from X = 0 to X = 18 mm.
- ✅ Verified Text history and deletion: toolbar Undo restored X = 0, Redo restored X = 18, Delete removed the Text solid, and Undo restored it.
- ✅ Verification completed: focused shape-library unit test, `npm run ci` (9 files / 51 tests), and `npm run pages:build` all passed.
- ✅ Added a **Connectors** tab with two classroom-ready, CSG-compatible presets: a solid 8 × 8 × 16 mm **Peg** and a 10 × 10 × 12 mm **Socket** hole. Both reuse the existing cylinder geometry, so grouping, hole subtraction, export, and project files stay compatible.
- ✅ Browser-tested the full history path: added Peg and Socket, verified their dimensions and Socket hole mode, undid both additions, then redid both additions. Focused unit coverage, `npm run ci` (11 files / 67 tests), and `npm run pages:build` all passed.
- ✅ Redesigned the Shapes picker after visual review: its four category tabs now remain readable in a wider two-column picker, and its shape cards are no longer squashed into a narrow list.
- ✅ Added a **Printable Parts** tab with four editable starter models: **Name Tag** (an assembled 70 × 28 × 5 mm rounded plaque with a keyring hole and raised `NAME` label), **Phone Stand** (an editable 70 × 70 × 50 mm three-part base, angled back, and retaining lip), **Cable Guide** (18 × 18 × 8 mm tube), and **Spacer** (12 × 12 × 10 mm tube). They reuse existing primitives, preserving local-first save/open, CSG, export, and printability checks.
- ✅ Browser-reviewed the rendered picker, Name Tag, and Phone Stand. The featured parts are no longer primitive placeholders; the Phone Stand was separated into editable parts, undone back into its assembly, and redone, while the full Printable Parts suite covered creation/undo/redo of every preset.
- ✅ Browser-tested creation of all four presets at their intended dimensions, then undid all four creations and redid all four. Focused unit coverage, `npm run ci` (11 files / 68 tests), and `npm run pages:build` all passed.
- ✅ Fixed a Name Tag separation regression: its keyring-hole child previously extended below the assembly's declared 5 mm base, which made it jump upward when separated. The child now fits within the assembly bounds, and unit coverage enforces that every multi-part starter remains vertically inside its declared group. Manual browser verification compared grouped and separated Name Tag and Phone Stand renders, then exercised Undo and Redo for both; all positions remained stable. `npm run ci` (11 files / 68 tests) and `npm run pages:build` passed.
- ⬜ Architectural shapes remain deliberately out of scope until the next approved increment.

### ✅ 5. Guided activities — DELIVERED AS GUIDED TUTORIALS (Tinkercad-style)

- A first pass shipped guided *activities* as one-click starter models (e.g. a name tag) inside the Shapes menu. On review this was the wrong shape: it was not a guided experience and lived in the wrong place. It was removed entirely.
- Replaced with a dedicated **Learn** dashboard section (sidebar item beside Home/Challenges) offering step-by-step tutorials, modelled on Tinkercad's lessons.
- The first tutorial, **"Learn the basics"**, teaches the five core moves — place, resize, rotate, hole, group. An in-editor left-hand panel shows numbered steps with a progress bar; steps **auto-advance** when the student completes the action (detected from the live scene via `computeTutorialSignals`), with a manual **Next/Back** fallback so it never gets stuck. Each completed step fires a **confetti** celebration. Exit/Finish keeps the project.
- New pure module `apps/web/src/lib/tutorials.ts` (unit-tested, 12 cases) holds tutorial content + detection logic, so further tutorials (dice, phone stand, name-tag-as-tutorial) are one entry each.
- Verified: `npm run ci` (11 files / 66 tests) green; full interaction pass in the running app — all five steps (place, resize, rotate, hole, group) auto-advance, plus the manual Next fallback, Back, Exit, confetti burst, and no regression to undo/redo/delete with the panel open. The rotate step was confirmed by driving the actual rotate gizmo handle (box rotated to Y = 292.5°, panel advanced "Rotate it" → "Make a hole").

### ✅ 6. Printability preflight — IMPLEMENTED AND INTERACTION-TESTED (PRIORITIZED AHEAD OF CONNECTORS)

- Added an offline, non-blocking **Printability check** directly in the Export panel. It checks the solids that will be exported (selected solids when selected; otherwise all solids, including hidden ones).
- Flags each affected shape by name for: a dimension below 1 mm, floating above the workplane, and a rotated or unrotated footprint extending outside the current workplane.
- A clean model shows **ready to export**; an empty model explains that a solid is needed. Warnings do not block STL/OBJ/STEP buttons, so teachers retain judgement over intentional designs.
- Interaction-tested in the running app: verified the empty state, clean ready state, all three warnings together (0.5 mm height, 2 mm elevation, X = 101 mm), then corrected the shape to 20 mm height / 0 mm elevation / X = 0 and verified the ready state returned. The STL button remained enabled in both warning and ready states.
- Verification completed: focused preflight unit coverage for clean, floating, undersized, out-of-workspace, rotated-footprint, hole, and hidden exported-shape cases; `npm run ci` (10 files / 54 tests); and `npm run pages:build` all passed.

### ✅ Final verification — COMPLETE

- `npm run ci`: green (11 files / 66 tests, typecheck clean).
- `npm run pages:build`: succeeded — 9/9 static pages generated and exported to `apps/web/out/`, including both WASM kernels (OCCT + Manifold) and the PWA files (`sw.js`, `offline.html`, manifest). Asset paths are correct for the subpath deploy (relative `./_next/…` plus the `/SketchForge-3D` base path).
- Deploy: the `deploy-pages.yml` workflow ran on push to `main` and completed successfully for both the guided-tutorials and ruler-undo-button commits.
- Live GitHub Pages smoke test: loaded the deployed site at `https://kiwispin.github.io/SketchForge-3D/` — the app boots with no console errors, assets resolve, and the **Learn** section renders the "Learn the basics" card (7 steps, Start button).
