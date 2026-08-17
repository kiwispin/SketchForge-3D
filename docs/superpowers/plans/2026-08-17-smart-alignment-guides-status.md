# Smart alignment guides status

**Date:** 2026-08-18
**Branch:** `codex/tinkercad-rotation-parity`

## Scope delivered

The first Canva-style alignment increment is implemented as a visual-only aid
during direct shape movement on the horizontal workplane:

- compares the moving selection centre with nearby unselected shape centres;
- finds the closest X and Z centre matches within a 1.25 mm tolerance;
- draws a cyan dashed guide across the workplane for the dominant active axis;
- shows a live label such as `Center X · ΔX 0.00`;
- follows the active X/Z drag direction and measures toward the corresponding
  reference side;
- works when the moving shape overlaps or sits inside a larger reference shape;
- draws an orange side-distance segment with a label such as `Left edge · 32.00`;
- reports `0.00` when the moving side reaches the reference side and avoids
  confusing negative gap values after contact;
- hides the ordinary resize dimension marks while a direct move is active;
- never renders smart-guide labels for an idle selection;
- suppresses centre labels while a side-distance guide is active, preventing
  stacked competing readouts;
- clears the guides immediately when the drag ends;
- does not change the object's position or introduce snapping.

The matching logic is isolated in `apps/web/src/lib/smartGuides.ts` and covered
by `tests/unit/smartGuides.test.ts`. The UI is rendered by the new
`SmartGuideOverlay` in `ActionOverlays.tsx` and is wired into the existing
direct-drag preview path in `WorkplaneViewport.tsx`.

## Verification

- `npm run typecheck` passes.
- `npm test -- --run` passes: 17 files, 146 tests.
- `npm run test:e2e` passes: 8 tests.
- `npm run build` passes.
- Local browser smoke test loaded the editor, verified that both an empty
  workplane and a selected idle shape render zero smart-guide overlays, and
  reported no console warnings or errors. The live overlay is transient and
  clears on release.

## Deliberately deferred

This increment does not yet add height/Y guides or magnetic snapping. Those
should be separate reviewable increments after the centre and directional side
guides have been visually approved with the two-cylinder eye case.
