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
2. ✅ Added host and join controls, temporary display names, a visible invite code, guest joined-state, and an explicit host end-session control. The host sees the automatically detected private-LAN join address for students to type before using the invite code. The join flow is a focused accessible dialog with invite-code formatting, validation feedback, and clear Join/Cancel actions. Invite codes accept typed values with or without the display hyphen and avoid ambiguous `I`, `L`, and `O` characters.
3. 🟡 Added bidirectional snapshot synchronization for editor changes, including propagated undo/redo. The transport is resilient to React remount/reconnect races and preserves each participant's local project copy when the host ends a room. The invite strip now shows joined student names. Shape-level locks and conflict handling remain to be built.
4. 🟡 Shared sessions now disable import, sketch mode, Boolean intersection, chamfer/fillet, and sketch editing. Core geometry, selection, transforms, colour/hole, duplicate/delete, group/ungroup, undo, and redo remain available. Remaining work: enforce the same restriction for non-toolbar entry points and add shape-level locks/conflict feedback.
5. 🟡 Verified: two independent browser pages completed host-to-guest create, guest-to-host create, undo, redo, joined-name presence, disabled shared-session controls, and host-ended-session/local-copy scenarios. `npm run ci` passed (12 files / 72 tests) and `npm run build` passed in the Linux test environment. The isolated Docker stack was built and launched on ports 3110/3111; both `/healthz` endpoints returned successfully. The new `npm run dev:collaboration` launcher was itself exercised by the complete two-browser flow. Cross-machine LAN verification remains.

## Tauri LAN Delivery Plan

**Added:** 2026-07-14
**Goal:** Deliver the same editor as a double-click Windows app. The app starts its LAN room service and discovers nearby sessions itself, so students do not type terminal commands, IP addresses, or URLs.

1. ✅ Installed and verified the Windows Rust/Tauri toolchain and the necessary Visual C++ ARM64 linker/SDK workload. A Tauri 2 shell now packages the existing static editor build. `scripts/build-desktop.ps1` launches the correct Visual Studio developer environment before building.
2. ✅ Moved the temporary room API/WebSocket relay into the desktop application. The Rust service is bound locally on port 3101 and has the same ephemeral room, invite-code, snapshot, presence, replace, and end-session protocol as the browser development service.
3. ✅ Added UDP LAN session announcements and native discovery. The desktop join dialog presents nearby students' sessions, fills the selected invite code, and still requires that code; a host's own session is excluded from its picker. No addresses, URLs, QR codes, accounts, or cloud service are exposed to students.
4. ✅ Connected the editor to the native service and discovery command only when it runs inside Tauri. Browser/LAN development mode keeps its existing service origin and manual join behaviour unchanged.
5. 🟡 Built and smoke-tested Windows installers. The compiled desktop executable was launched and its bundled `/healthz` endpoint returned `{ ok: true }`. `npm run test:desktop:service` then verified room creation, invite-code join, guest-to-host edit propagation, host-to-guest reverse propagation (the transport used by undo), and host end-session propagation. `npm run ci` remains clean (12 files / 72 tests); Rust formatting and `cargo check` are clean; the Windows static export succeeds. Built artifacts: `src-tauri/target/debug/bundle/msi/SketchForge LAN_0.1.0_x64_en-US.msi` and `src-tauri/target/debug/bundle/nsis/SketchForge LAN_0.1.0_x64-setup.exe`. Remaining release acceptance: install the setup executable on two separate school-LAN desktops and manually confirm discovery and the visible editor flow; Windows Firewall/private-network permission must be allowed if prompted.
