# Rotation and Tinkercad-parity remediation status

**Date:** 2026-08-02
**Branch:** `codex/tinkercad-rotation-parity`
**Supersedes:** `2026-08-01-rotation-roadmap-status.md` (self-approving; its 3-corner
handle model deviated from Tinkercad and the document declared success without
visual evidence)

## Context

The previous branch shipped a Fusion-360-style 3-axis rotation gizmo (three
handles on the selection-frame corners, projected protractor ellipse) and
declared "Tinkercad parity" complete in a self-authored status doc. That did not
match Tinkercad's interaction model and several increments were broken at
runtime. This branch reworks rotation around one shared mathematical source of
truth and fixes the broken roadmap items. Work follows the approved Luna plan;
each stage is one reviewable commit.

## Stage log (each with acceptance evidence)

### Stage 1 — One rotation-axis contract (`5b80ff4`)
- Introduced `RotationPlaneDescriptor` (world axis vector, in-plane basis, pivot,
  screen projection, handle anchor) as the single source of truth consumed by
  both protractor rendering and the drag ray-plane angle.
- Handles use world-plane identity: X means rotation around the world X axis,
  independent of the object's own orientation.
- Moved `signedAngleAroundAxis` / `unwrapRadians` into the pure module.
- Evidence: 4 new unit tests (world-plane identity, wheel matrix, signed angle,
  unwrap) in `tests/unit/transformOverlayTypes.test.ts`; browser drag verified.

### Stage 2 — Semantic handle anchors (`341440c`)
- Replaced frame-local corner labels (top-left/top-right/bottom) with
  world-plane face-centre anchors (`worldPlaneHandleAnchor`), so the three
  handles stay on distinct faces and cannot reorient with a pre-rotated object.
- Camera-facing side selection with hysteresis: handles only flip when the
  camera clearly crosses the pivot plane.
- Evidence: unit tests for face-centre anchoring, hysteresis, and side-switch;
  browser orbit through all six views showed distinct, non-teleporting handles.

### Stage 3 — Active protractor (verified, no code change)
- Existing `activeRotationAxis`, red handle, orange sector, zero/current lines,
  degree readout, and 22.5°-inner / 1°-outer / Shift snapping were verified in
  the browser (red `rgb(228,81,53)` during capture, -45° coarse / -24° fine).
- Evidence: screenshots `r15-rot-hover.png`, `r16-rot-active.png`.

### Stage 4 — Camera controls (`eb96b66`)
- Fixed the polar clamp so Top/Bottom views commit exactly (±90°) on first click
  instead of landing at ~86.5°. Top/bottom already used non-parallel up vectors.
- Evidence: browser probe showed all six faces at exact pitch/yaw; existing
  `viewCube` tests plus orthographic Fit Selection from projected corners.

### Stage 5 — Genuine duplicate-and-repeat (`ba67231`)
- Fixed repeat-after-rotation: baking zeroes `rotation` and grows dimensions to
  the AABB, so the old code misread rotation as scale (20→28.129→39.56).
- `repeatShapeTransform` now recovers the displayed rotation from
  `cadPrimitiveFrame.frame.sourceTransform` and measures scale against the
  primitive's own dimensions; rotation deltas replay cumulatively.
- Evidence: 3 new unit tests (baked rotation as rotation, non-identity source,
  movement/scale) in `tests/unit/duplicateRepeat.test.ts`; browser repeat after
  rotate and multi-selection repeat verified (0→12→24, -25→-13→-1).

### Stage 6 — Face workplanes (verified + test `8a059cc`)
- Existing implementation already satisfies the plan: world-space face normal
  via `getNormalMatrix`, right-handed `planeFromFace` basis, flush placement via
  `placementPointOnPlane`, corrected XY/XZ labels.
- Evidence: new unit test for rotated-side-face flush placement; browser: top
  face in orthographic view placed a new box exactly at elevation 20 on the
  y=20 face.

### Stage 7 — Origin ruler contract (`211759c`)
- Fixed conflation with the measurement ruler: origin mode no longer forces
  ruler mode, clears the selection, or blocks clicks. It places a
  non-interactive origin marker, keeps ordinary selection working, and shows a
  live `X / Z / Y` readout of the selected object relative to the origin.
- Turning the feature off removes the marker/readout and restores selection.
- Evidence: browser probe (selection while on, live `X 10.00 · Z 0.00 ·
  Y 0.00`, overlay cleared on off).

### Stage 8 — Unified transform feedback (`bcd072d`)
- One structured feedback vocabulary: move/resize/height/lift report
  ΔW/ΔD/ΔH, ΔX/ΔZ, ΔH, ΔY deltas; rotation reports degrees. Labels use a fixed
  clamped screen offset so they do not obscure handles.
- Evidence: 4 unit tests for `formatDeltaText` / `formatAngleText` /
  `feedbackScreenPoint`; browser move (`ΔX 9.00`) and lift (`ΔY 10.00`).

### Stage 9 — Verification suite (`bb78463`)
- Automated coverage across stages lives in the unit suites (136 tests, CI
  green). Browser screenshot matrix captured to `.tools/verify-shots/r1*.png`:
  box/sphere/cylinder, small/large selection, wide text, irregular multi,
  elevated, three handles idle/hover/active, six views + oblique, perspective
  and orthographic, narrow viewport. No console errors.

## Release gate

- `npm run ci`: 16 files / 136 tests green.
- `npm run test:e2e`: 8 tests green.
- `npm run build`: production build succeeds.
- Browser matrix: full screenshot set captured with zero console errors.

## Honest status

- The rotation handles now share one mathematical source of truth and use
  world-plane identity, so a pre-rotated object cannot reorient them.
- Remaining visual decisions (e.g. the exact handle glyphs, whether the three
  handles should be reduced to Tinkercad's single top handle) are pending the
  human visual review against the agreed references. This branch is NOT claimed
  complete against Tinkercad visuals — the interaction model is fixed, the
  visual parity decision is still open.
- PR is intentionally kept in draft until that visual approval and the
  screenshots are reviewed.
