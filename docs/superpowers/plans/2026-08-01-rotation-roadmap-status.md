# Rotation and Tinkercad-parity roadmap status

**Date:** 2026-08-01
**Branch:** `codex/tinkercad-rotation-parity`
**Status:** Implementation complete; release verification in progress

## Approved rotation implementation

The rotation work follows the approved plan exactly:

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

- Unified transform feedback: complete.
- Fit Selection, view reset, view cube parity, and orthographic mode: complete.
- Snap-aware keyboard movement: complete.
- Remembered duplicate-and-repeat transformations: complete.
- Oriented face workplanes: complete.
- Optional coordinate-origin ruler: complete.

## Verification matrix

The release check covers single and rotated boxes, spheres, cylinders, small and large objects, wide text, irregular assemblies, multi-selection, elevated objects, all six cardinal views plus oblique views, continuous orbit, zoom, all three rotation handles, coarse and fine snapping, numeric angles, undo/redo, movement/lift/resize, desktop and narrow viewports, and export compatibility. Pure geometry and transform behavior is covered by unit tests; browser smoke checks cover the controls and placement workflow that unit tests cannot render.

## Release gate

The branch is ready to publish after the final `npm run ci`, production static build, clean diff check, and GitHub push. Deployment is intentionally kept as one reviewable commit so the rotation parity and roadmap increments can be rolled back together if a regression is found.
