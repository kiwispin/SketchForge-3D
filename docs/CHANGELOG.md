# Changelog

## Unreleased

Classroom features from the kiwispin fork, merged onto upstream 0.9.0 (MIT base). Upstream's `.skf` project format, export dialog, dashboard, editor history and static export remain the foundation; the items below were added on top.

- Guided tutorials: a new **Learn** section on the dashboard with step-by-step, in-editor lessons. The first tutorial, "Learn the basics", walks students through placing, resizing, rotating, cutting a hole, and grouping shapes. Each step auto-advances when the student completes the action (with a manual Next fallback) and celebrates success with a confetti burst.
- Printability preflight: the export dialog checks the full visible design for floating parts, parts under 1 mm, and parts outside the workspace before STL, OBJ, or STEP export, without blocking the export.
- Google Drive: optional **Save to Drive** for `.skf` projects (linked file, View in Drive, Save a copy) and **Open from Drive** on the dashboard and in the Import panel, enabled by a Google OAuth client ID. See `docs/google-drive-setup.md`.
- Projects: older `.sketchforge` / `.sketchforge.json` files open read-only as new projects and are saved as `.skf` from then on; the design name can be renamed from the editor's tab strip; an autosave indicator shows Saving / Saved / Save failed.
- Installable offline PWA with a per-build service-worker cache, and a GitHub Pages deploy workflow for the static export.
- Movement controls: compact double-headed X/Z axis arrows and a separate lift triangle, with ΔX/ΔZ/ΔY and resize deltas shown while dragging.
- Rotation controls: Tinkercad-style rotation glyphs anchored to the selection frame, with a display-only protractor, coarse/fine snapping, and click-to-type angles.
- Rotated shapes keep their own selection frame: after rotating a single shape, its dashed frame, resize handles, dimension labels, move arrows and rotation rings follow the shape and hug its true size, resizing (handles, typed labels, inspector) stretches it along its own axes instead of shearing it, and further rotations compose with the existing angle. Imported and sketch meshes included; the orientation is saved in `.skf` files.
- View and placement tools: Fit Selection (F), a front-aligned Home view, view-cube snaps that keep native orbit, and a ruler-from-origin readout.
- Editing: smart alignment guides while dragging, exact placement fields, distribute evenly, duplicate/repeat that remembers the last offsets, snap-aware keyboard nudging, proportional resize, and an editable, undoable ruler.
- Safe STL export: STL exports the full visible design with holes cut and refuses to write broken meshes; selection-only export is a separate, explicit option.
- Shape library: Text, Connectors, Printable parts (including a name tag and phone stand), and Architectural (Wall, Window, Door, Roof) categories with coloured preview icons.

## 0.1.0

- Initial open-source alpha.
- Browser-based 3D workspace with primitive shape editing.
- STL import and STL/OBJ export.
- Grouping and hole subtraction workflows.
- Local project dashboard with generated thumbnails.
