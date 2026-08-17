# Changelog

## Unreleased

- Guided tutorials: a new **Learn** section on the dashboard with step-by-step, in-editor lessons. The first tutorial, "Learn the basics", walks students through placing, resizing, rotating, cutting a hole, and grouping shapes. Each step auto-advances when the student completes the action (with a manual Next fallback) and celebrates success with a confetti burst.
- Movement controls: restored the original compact double-headed axis arrows and simple vertical lift triangle, removing the colored Unreal-style translate gizmo.
- Rotation controls: use fixed screen-space Tinkercad-style slots (top-left, top-right, and bottom-right) around the visible selected-shape envelope, and replace the detached world-space ellipse with one compact protractor centered on the selection pivot while dragging.
- Transform workflow: added true selection-pivot rotation for groups, plane-specific idle handles, fixed screen-space sizing, 16 x 22.5-degree coarse snapping with fine outer rotation, active angle feedback, and camera-stable projection.
- View and placement tools: added Fit Selection, Home/reset view, perspective/orthographic toggle, an origin ruler overlay, and Ground/Top/Bottom/Front/Back/Left/Right oriented workplanes with face-aware drag/drop placement.
- Feedback and repetition: unified move/resize/lift deltas in the transform overlay, snap-aware keyboard movement steps, and duplicate/repeat memory so repeated copies retain the last offset choices.
- Shape library: added an Architectural category with editable Wall, Window, Door, and Roof starters, each with a dedicated preview and classroom-ready dimensions.

## 0.1.0

- Initial open-source alpha.
- Browser-based 3D workspace with primitive shape editing.
- STL import and STL/OBJ export.
- Grouping and hole subtraction workflows.
- Local project dashboard with generated thumbnails.
