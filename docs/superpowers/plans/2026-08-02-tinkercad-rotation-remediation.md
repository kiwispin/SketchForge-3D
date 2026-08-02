# Tinkercad Rotation Parity — Corrected Remediation Plan

**Date:** 2026-08-02
**Branch:** `codex/tinkercad-rotation-parity`
**Supersedes:** `2026-08-01-rotation-roadmap-status.md` (self-approval doc whose 3-handle model deviates from Tinkercad)

## Why the previous plan failed

The prior status doc's "approved implementation" centered on **three plane-specific idle handles on the
selection-frame corners** (`rotationHandleLocalAnchor`). Tinkercad uses **one curved-arrow handle on the top
face** that rotates the shape around the vertical (Y) axis and shows a **flat protractor dial on the workplane**
beneath the shape. The old doc described a Fusion-360-style 3-axis gizmo, then declared Tinkercad parity.
This plan corrects the interaction model to match Tinkercad's actual UX.

## Target interaction model (True Tinkercad)

1. Selecting a shape shows **one rotation handle**: a curved double-arrow arc anchored to the top face of the
   selection frame, at constant screen size.
2. Dragging that handle rotates the selection around its **up (Y) axis**.
3. While dragging, a **flat protractor dial is rendered on the workplane** (the ground/active horizontal
   plane) centred under the selection, with degree ticks and a live degree readout.
4. X/Z axis rotation stays available via **numeric fields in the shape inspector** (not on-canvas gizmos).
5. Multi-selection rotates around the shared pivot using the existing quaternion/ray-plane engine.
6. The handle and dial stay attached to the selection while the camera orbits or zooms.

## Changes by file

### `apps/web/src/components/workplane/transformOverlayTypes.ts`
- Replace the three-axis `rotationHandleLocalAnchor` with a single top-face anchor
  (e.g. `topRotationHandleAnchor(frame)` → `{ x: 0, y: frame.height / 2, z: 0 }`).
- Reuse `screenRotationWheel` for the fixed 168 px radius, but build the dial matrix from the **world
  horizontal axes** (projected X and Z) so the dial lies flat on the workplane rather than in the selected
  world plane. Add `workplaneRotationWheel(centerScreen, pivotWorld, axes, rect)` or reuse
  `projectedRotationWheel` with horizontal axis inputs.
- Simplify `rotationSnapDelta` for a Tinkercad feel: per-degree free rotation with Shift snapping to 15°.
  Keep the existing testable signature.

### `apps/web/src/components/workplane/TransformOverlay.tsx`
- Render **one** rotate handle (drop the `rotate-x`/`rotate-z`/`rotate-y` triple loop).
- Replace the 16-segment inner zone with a **Tinkercad-style tick dial**: major ticks every 30°/45°,
  minor ticks every 5°, outer rim, centre dot, zero line, orange current-line, and the degree readout.
- Keep the existing wheel `matrix()` projection so the dial renders flat and stays glued to the pivot.

### `apps/web/src/components/workplane/ShapeInspector.tsx`
- Add numeric **Rotate X / Rotate Y / Rotate Z** fields (Y is primary; X/Z are how non-Y rotation is done).
  Persist via the existing `onUpdate` path (`rotation`, `rotationX`, `rotationZ` + `bakeTransform`).

### `apps/web/src/components/WorkplaneViewport.tsx`
- `syncTransformOverlay`: emit a single top-face handle; compute one workplane-flat wheel for the Y axis;
  keep `rotationPlaneCenters` for the ray-plane drag.
- `rotationAxisForHandle`/`beginTransform`/`updateTransform`/`finishTransform`: pin the drag axis to **Y**
  (frame up vector); the ray-plane uses the horizontal plane through the shared pivot.
- `onHoverRotationHandle`, `rotationWheelAxis`, `activeRotationAxis`, `hoveredRotationWheelAxis`: collapse to
  a single Y-axis path.
- `beginRotationEdit` stays for the numeric degree entry on handle click (Y only).

### Tests
- Update `tests/unit/transformOverlayTypes.test.ts`: single top-face anchor, workplane-flat dial matrix,
  15° shift-snap, fixed 168 px radius.
- Add a regression test for multi-shape bake-through-`updateShape` (guards the bug fixed on 2026-08-02:
  non-interactive patch path must read `shapesRef.current`, not the stale closure `shapes`).
- Keep existing `viewCube`, `workplanePlanes`, `duplicateRepeat` coverage unchanged.

## Out of scope / deliberately preserved
- Quaternion + ray-plane + multi-selection transform engine (unchanged).
- Fixed screen-space radii, pivot-centring, camera-attachment behaviour.
- Follow-on roadmap items already delivered (feedback readouts, fit/view/ortho, keyboard snap-move,
  duplicate/repeat, oriented workplanes, origin ruler) — no changes.

## Acceptance checks
1. Browser: select a Box → exactly **one** curved-arrow handle on the top face.
2. Browser: drag it → a **flat dial on the workplane** + live degree readout; shape rotates around Y.
3. Browser: multi-select → shared-pivot rotation; all members bake consistently to mesh on release.
4. Browser: camera orbit/zoom during drag → handle and dial stay attached.
5. Browser: X/Z numeric rotation fields in the inspector produce the same bake result.
6. `npm run ci`, `npm run test:e2e`, production build all pass.
