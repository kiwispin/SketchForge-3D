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
2. ⬜ Add host/join controls and temporary display names.
3. ⬜ Synchronize core modelling operations with locks, presence, and local-only undo.
4. ⬜ Disable unsupported advanced tools in shared sessions.
5. ⬜ Execute two-browser, LAN Docker, regression, and production-build verification.
