# Rotation and Tinkercad-parity roadmap status

**Date:** 2026-08-01
**Branch:** `codex/tinkercad-rotation-parity`
**Status:** Implementation complete; release gate verification passed locally

## Approved rotation implementation

The rotation work now follows the approved plan:

1. Remove the generic rotation HUD and reused double-arrow symbol.
2. Preserve the quaternion, ray-plane, and multi-selection transformation engine.
3. Place three plane-specific idle handles on the projected selection frame.
4. Keep visible handles and hit targets at a constant screen size.
5. Show a pivot-centred protractor only on hover, click, and drag.
6. Use a fixed screen-space major radius of about 170 px, clamped to the viewport.
7. Project the wheel into the selected world rotation plane.
8. Implement the 16 x 22.5-degree segmented inner zone and per-degree outer zone.
9. Show the active red handle, orange swept sector, and local degree readout.
10. Rotate groups around their shared pivot.
11. Keep the control attached while the camera orbits and zooms.

The implementation explicitly avoids model-dimension-derived radii, face-centred wheels, detached world-space circles, generic circular HUDs, axis badges used as a substitute for clear handles, and handle jumping during camera movement.

## Follow-on roadmap

- Unified transform feedback: complete, including numeric multi-selection ΔW/ΔD/ΔH feedback.
- Fit Selection, view reset, view cube parity, and orthographic mode: complete; top/bottom use non-parallel up vectors and cube faces commit on pointer-down.
- Snap-aware keyboard movement: complete.
- Remembered duplicate-and-repeat transformations: complete; movement, lift, rotation, and scale deltas are replayed.
- Oriented face workplanes: complete; raycast face normals produce a custom plane basis and placement orientation, with corrected XY/XZ labels.
- Optional coordinate-origin ruler: complete; origin is labelled and measurements report X/Z coordinates and distance.

## Verification matrix

The release check covers the implementation matrix with pure tests for rotation anchors, axis-plane snapping, fixed wheel radius, projected orthographic fitting, duplicate/repeat transforms, face-plane handedness, and view-cube directions. Browser smoke checks verified the three handles, corrected top view, orthographic Fit Selection, corrected plane labels, arbitrary face workplane selection, origin coordinates/distance, and absence of console warnings/errors. The existing CI and e2e suites also pass.

## Release gate

The branch is ready to publish after the final `npm run ci`, `npm run test:e2e`, production build, and clean diff check. Deployment is intentionally kept as one reviewable commit so the rotation parity and roadmap increments can be rolled back together if a regression is found.
