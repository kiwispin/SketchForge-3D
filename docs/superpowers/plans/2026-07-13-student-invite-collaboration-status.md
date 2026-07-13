# Student Invite-Code Collaboration — Plan & Execution Status

**Started:** 2026-07-13  
**Branch:** `experiment/student-invite-collaboration`  
**Goal:** Let one desktop student invite another to edit the same SketchForge project using a typed code, while preserving local-first project copies and leaving `main` untouched.

## Guardrails

- This work exists only in the dedicated collaboration worktree and branch.
- No QR codes, accounts, teacher role, persistent rooms, cloud project storage, or production deployment changes.
- Student A owns the live session; both students can edit core modelling tools.
- When Student A ends/leaves, the live room and code expire. Both students keep their final local projects.
- This file is updated after each implementation, verification, and commit milestone.

## Delivery plan

1. ✅ Added isolated LAN room service, code lifecycle, snapshot relay, and presence protocol, plus the dedicated Docker stack. Verification in the Linux test environment: service health check returned `{ "ok": true }`; `npm run ci` passed (12 files / 72 tests, typecheck clean).
2. ✅ Added host and join controls, temporary display names, a visible invite code, guest joined-state, and an explicit host end-session control. Invite codes accept typed values with or without the display hyphen and avoid ambiguous `I`, `L`, and `O` characters.
3. 🟡 Added bidirectional snapshot synchronization for editor changes, including propagated undo/redo. The transport is resilient to React remount/reconnect races and preserves each participant's local project copy when the host ends a room. The invite strip now shows joined student names. Shape-level locks and conflict handling remain to be built.
4. 🟡 Shared sessions now disable import, sketch mode, Boolean intersection, chamfer/fillet, and sketch editing. Core geometry, selection, transforms, colour/hole, duplicate/delete, group/ungroup, undo, and redo remain available. Remaining work: enforce the same restriction for non-toolbar entry points and add shape-level locks/conflict feedback.
5. 🟡 Verified: two independent browser pages completed host-to-guest create, guest-to-host create, undo, redo, joined-name presence, disabled shared-session controls, and host-ended-session/local-copy scenarios. `npm run ci` passed (12 files / 72 tests) and `npm run build` passed in the Linux test environment. The isolated Docker stack was built and launched on ports 3110/3111; both `/healthz` endpoints returned successfully. The new `npm run dev:collaboration` launcher was itself exercised by the complete two-browser flow. Cross-machine LAN verification remains.
