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

`tests/unit/transformOverlayTypes.test.ts` covers projected protractors, signed
world-plane angles, movement projection, and the measured 129/168 inner snap
band with 22.5-degree, one-degree, and Shift 45-degree behavior.
