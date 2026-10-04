# Gizmo V2 validation record

The V2 implementation separates semantic rotation identity, camera-dependent
presentation, visibility lifecycle, projection, rendering, and drag math.

## Required browser checks

- Initial load and Home reset use a front-aligned, zero-yaw camera pose while retaining enough elevation to show the workplane.
- Lower control is outside the presented face and its open side points back to that face.
- The lower control's expanded protractor lies on the selection's lower workplane-contact level, not through its vertical centre.
- Every projected protractor uses a right-handed plane basis, so its angle marker advances in the same direction as the object rotation.
- Both lower arrowheads share one symmetric SVG primitive; the compact glyph stays rigid while its expanded protractor is projected into the workplane.
- Upper compact glyphs also stay rigid, rotate their open side toward their selected face, and leave 3D plane projection to the expanded protractor.
- Lower control is not covered by the lift-control hitbox.
- Camera orbit hides compact rotation controls only while the pointer gesture is active.
- The first post-release frame re-presents the lower control on the state-machine-selected face and keeps it projected correctly while camera damping settles.
- Hovering the lower control shows the workplane protractor.
- Hovering either upper control shows the corresponding vertical protractor.
- A vertical control is suppressed when its world rotation plane is edge-on.
- A real pointer drag rotates an asymmetric box around the selected world axis.
- Move controls show opposing filled triangles without a shaft and drag along world X/Z.

## Automated geometry coverage

`tests/unit/gizmoV2.test.ts` covers face resolution, five-degree directional
handoff, new-selection reset, local-camera yaw, lower and upper anchors, affine
glyph projection, edge-on suppression, placement/orientation, and immediate
post-release orbit visibility.

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

## Port note (upstream sync)

Ported onto the upstream base with the rest of the fork's gizmo work. On this
base the selection frame is aligned to the active placement workplane, so the
"world" planes above are the workplane's axes: on the base workplane they are
the world axes the oracle fixture describes, and on a tilted workplane the X/Y/Z
controls rotate about that workplane's X, normal and Z
(`frameRotationPlanes` in `transformOverlayTypes.ts`). The browser checks
above were made against the fork and should be repeated on this base.
