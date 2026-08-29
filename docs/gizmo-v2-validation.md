# Gizmo V2 validation record

The V2 implementation separates semantic rotation identity, camera-dependent
presentation, visibility lifecycle, projection, rendering, and drag math.

## Required browser checks

- Lower control is outside the presented face and its open side points back to that face.
- Both lower arrowheads share one symmetric SVG primitive; the whole primitive receives one affine workplane projection at oblique camera poses.
- Lower control is not covered by the lift-control hitbox.
- Camera orbit hides compact rotation controls immediately and through damping.
- The first settled frame re-presents the lower control on the state-machine-selected face.
- Hovering the lower control shows the workplane protractor.
- Hovering either upper control shows the corresponding vertical protractor.
- A vertical control is suppressed when its world rotation plane is edge-on.
- A real pointer drag rotates an asymmetric box around the selected world axis.
- Move controls show opposing filled triangles without a shaft and drag along world X/Z.

## Automated geometry coverage

`tests/unit/gizmoV2.test.ts` covers face resolution, five-degree directional
handoff, new-selection reset, local-camera yaw, lower and upper anchors, affine
glyph projection, edge-on suppression, placement/orientation, and orbit visibility.

The live 1600 × 1000 browser matrix covered Home, Front, Right, and Top
presentations; all three Home hit targets; lower, X, and Z hover protractors;
a measured lower-axis drag on an asymmetric box; immediate post-drag cleanup;
and X/Z move drags that changed only their matching inspector coordinate.

## Visual-mask correction

The first V2 visual gate failed despite passing interaction tests: affine glyph
projection enlarged and skewed the visible rotation curves, the move triangles
were oversized, and a white halo made the controls unlike the Tinkercad
reference. That render must not be treated as an acceptable baseline.

The corrected implementation keeps the generous interaction targets but renders
the visible rotation masks in fixed 44 x 28 CSS boxes, with an approximately
28 x 12 pixel dark mask. Both arrowheads and the curve are defined by one
symmetric SVG primitive, so the two arrowheads share the curve endpoints and
centreline. The move mask is 34 x 18 pixels and has no shaft. The idle rotation
color is `#555b5e` and no drop shadow is applied.

Post-correction browser checks covered the selected cube at Home and Fit
Selection zoom, fixed-size mask rendering at both zoom levels, three visible
Home rotation targets, and a clean runtime error log.

## Bottom-control transform correction

The bottom control must use the rigid face-facing angle directly. Applying the
workplane projection matrix to the compact idle SVG can yield a discarded CSS
matrix while also suppressing that angle, which leaves an unrotated partial
curve. Only the hover/drag protractor is plane-projected. The idle bottom mask
remains complete, fixed-size, and rotates as one unit toward the active face.

`tests/unit/transformOverlayTypes.test.ts` covers projected protractors, signed
world-plane angles, movement projection, and the measured 129/168 inner snap
band with 22.5-degree, one-degree, and Shift 45-degree behavior.
