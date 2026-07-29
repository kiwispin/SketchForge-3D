# SketchForge Current Status and Google Drive Rollout Plan

**Updated:** 2026-07-30

**Release:** 0.5.0

**Branch:** `main`

**Current deployed commit before this release:** `9b6c9ca` (`origin/main` was in sync)

**Live app:** <https://kiwispin.github.io/SketchForge-3D/>

## Executive summary

SketchForge is a working, local-first browser-based 3D modelling app. It is deployed as a static GitHub Pages application and does not have a SketchForge project server or require a separate SketchForge account.

Projects autosave inside the browser. Students can export an editable `.sketchforge` project file, save it directly to Google Drive, and reopen SketchForge-created Drive projects on another device. Direct Drive saving avoids the local-download failure case on managed Chromebooks when local storage is full or downloads are restricted.

The Google Drive integration is implemented with direct browser-to-Drive authorization and the narrow `drive.file` scope. The remaining work is school-domain approval and managed-Chromebook classroom validation, not a custom SketchForge server.

## Where the app is now

### Hosting and delivery

- Next.js/React/TypeScript application with Three.js and browser-based geometry tooling.
- Static production build deployed from `main` to GitHub Pages.
- Installable PWA shell with offline-capable app assets after the first successful load.
- Docker and local-development hosting remain available for schools or developers that want to run their own copy.

### Modelling workflow

- Primitive, text, connector, and printable-part shape libraries.
- Shape placement, exact X/Y/Z positioning, resizing, proportional three-axis scaling, rotation, duplication, repeat, alignment, and distribution.
- X/Y/Z movement handles with resize and lift controls separated to prevent handle collisions.
- Solid/hole grouping, intersection, separation, and undo/redo workflows.
- Chamfer and fillet edge tools.
- Guided in-app learning workflow.
- Printability checks for small dimensions, workspace boundaries, and unsupported disconnected components. Connected parts above the ground are treated as part of the supported design.
- New shapes are placed in a clear nearby area where possible instead of always being inserted at the workplane centre.

### Import and export

- Imports editable `.sketchforge` projects and supported STL, STEP, and SVG content.
- Exports `.sketchforge`, STL, OBJ, and STEP files.
- The `.sketchforge` format is JSON, versioned as `sketchforge-project` version 1, and preserves editable shapes, groups, holes, colours, workspace settings, and snap settings.
- Opening a `.sketchforge` file creates a new dashboard project rather than overwriting the current project.

### Current saving behaviour

| Save path | Current behaviour | Limitation |
| --- | --- | --- |
| Automatic project save | Project metadata is stored in `localStorage`; shape data is stored in IndexedDB. | Device/browser-specific and consumes local Chromebook storage. Clearing site data or changing device loses the local copy. |
| Save project | Serializes the current design and starts a browser download of a `.sketchforge` file. | Can fail when the Chromebook has no free space or downloads are restricted. |
| Local/Docker folder mode | A non-static local server can write exports to a configured folder. | Not available in the live GitHub Pages build and is not suitable for general student Chromebooks. |
| Google Drive | **Save to Google Drive**, update-in-place, **Save a copy**, **View in Drive**, and **Open from Drive** are implemented. | Requires network access, a writable Drive account, and school administrator permission where third-party OAuth apps are restricted. |

## Problem to solve

A student may have a valid design open in memory but be unable to download it because the Chromebook has no available local space. Asking the student to download and then manually upload is unreliable and still requires a successful local download.

There are two different Google Drive "read-only" cases:

1. **A shared folder is read-only.** SketchForge should save into the student's own `My Drive/SketchForge` folder instead.
2. **The student's whole Drive is unavailable, full, or blocked by school policy.** Direct Drive saving will also fail. The app must keep the design open, explain the exact problem, and retain Download as a fallback. A separate SketchForge recovery service could be considered later for this case.

## Implemented Google Drive experience

### Primary actions

- **Save to Google Drive** is the primary cloud-save action.
- **Download project (.sketchforge)** remains available as a local fallback.
- **Open from Google Drive** is available from the dashboard and editor import flow.

### First save

1. The student presses **Save to Google Drive**.
2. Google asks them to select/sign in to their school account and approve access.
3. SketchForge creates a `SketchForge` folder in the student's My Drive if needed.
4. SketchForge uploads the existing version-1 `.sketchforge` content directly from browser memory.
5. The app confirms the filename and provides a **View in Drive** link.

### Later saves

- If the project was previously saved to or opened from Drive, update that same Drive file rather than creating duplicates.
- If no Drive file is associated with the project, create a new one.
- Make **Save a copy to Drive** available when the student deliberately wants another version.
- Never report success until Google has returned a successful upload response.

### Opening

- Let the student select from `.sketchforge` files previously created by SketchForge and made visible through the narrow `drive.file` scope.
- Download the selected file into browser memory and pass it through the existing `parseProjectFile()` validation.
- Preserve the current rule: open it as a new dashboard project, leaving the currently open project untouched.
- Record the selected Drive file ID so subsequent saves update the correct file.

## Technical approach

### Architecture decision

The implementation uses a direct browser-to-Google-Drive integration:

```text
SketchForge in Chromebook browser
        |  Google sign-in and short-lived access token
        v
Google Drive API
        |
        v
Student's My Drive / SketchForge / Design.sketchforge
```

No project contents, Google password, client secret, or long-lived refresh token pass through a SketchForge server. The Google OAuth client ID is public browser configuration; no client secret is included in the application.

### Google configuration

1. Create or select a Google Cloud project controlled by the appropriate organisation.
2. Enable the Google Drive API and, if used for opening files, Google Picker API.
3. Configure the OAuth consent screen. Prefer an organisation-internal app if the school owns and can administer the Google Cloud project; otherwise configure the required public/test-user flow.
4. Create a Web OAuth client ID.
5. Add authorised JavaScript origins:
   - `https://kiwispin.github.io`
   - local development origins such as `http://localhost:3000`
6. Request only `https://www.googleapis.com/auth/drive.file`. This permits access to files SketchForge creates or files the student explicitly chooses, without granting access to their entire Drive.
7. Ask the school's Google Workspace administrator to allowlist the OAuth client or grant it access to the specific Drive scope if third-party apps are restricted.

### Implemented application components

- Google Identity Services loader and short-lived in-memory token client.
- A dedicated Drive module responsible for:
  - requesting access only after a student presses a Drive action;
  - creating/finding the SketchForge folder;
  - creating, updating, listing, and opening `.sketchforge` files;
  - returning typed, user-friendly error states;
  - never storing access tokens persistently.
- Reuses `serializeProjectFile()`, `parseProjectFile()`, and `projectFileName()` so local and Drive files remain identical and interchangeable.
- Stores Drive file ID, filename, and cloud-save time with local project metadata while still allowing the Drive file to be opened on another device.
- Uses Drive app properties to identify SketchForge-created project files.
- Keeps local IndexedDB autosave for fast editing and crash recovery.

### Error handling requirements

| Condition | Required behaviour |
| --- | --- |
| Student cancels sign-in or consent | Leave the design untouched and say that Drive access was cancelled. |
| Access token expires | Ask for Google access again on the next explicit Drive action. |
| Shared folder is read-only | Save to the student's own SketchForge folder or ask them to choose another writable location. |
| Drive is full/read-only/admin-blocked | Show an accurate message, keep the project open, and offer Download. Never claim it was saved. |
| Network drops during upload | Keep the project open and allow Retry. |
| Existing Drive file was removed or access changed | Offer to create a new Drive copy. |
| File is invalid or from a newer SketchForge version | Use the existing project-file validation messages; do not create a broken dashboard project. |

## Delivery plan

### Phase 0 — school and Google rollout validation (REMAINING)

- Confirm whether the students use one managed Google Workspace domain.
- Confirm whether "read-only" affected a shared folder or each student's entire My Drive.
- Confirm who owns and maintains the existing Google Cloud project and OAuth consent screen.
- Confirm the production OAuth client is approved/allowlisted for the student organisational unit.
- Test with at least one real school-managed student account.

**Output:** a confirmed school-managed test account and administrator-approved production OAuth client.

### Phase 1 — Save to Google Drive MVP (IMPLEMENTED)

- Implement Google sign-in/authorization on an explicit button press.
- Upload the current `.sketchforge` project directly to `My Drive/SketchForge`.
- Store the returned Drive file ID with the local project.
- Update the same file on later saves.
- Add success, retry, cancellation, quota, permission, and offline messages.
- Retain Download as a secondary option.

**Acceptance test:** on a Chromebook with browser downloads unavailable, a student can save the open project to My Drive, see the file in Drive, and open/download valid `.sketchforge` JSON from Drive.

**Delivered:** commit `19b4780`, with later UI polish in `3e4fdb2` and `964499c`.

### Phase 2 — Open from Drive and classroom polish (IMPLEMENTED)

- Add Google Picker or an app-owned project list.
- Open a chosen Drive file through the existing parser as a new project.
- Associate the newly opened project with its Drive file for future updates.
- Add **View in Drive**, **Save a copy**, cloud-save timestamps, and clearer local-versus-Drive status.
- Test multiple accounts, expired tokens, revoked permission, full Drive, shared-folder permissions, offline recovery, and managed Chromebook popup restrictions.
- Add unit tests around Drive response/error mapping and browser-driven tests around the UI flow using a mocked Drive boundary; perform a real-account staging smoke test separately.

**Acceptance test:** a student can save on one Chromebook, open the project from Drive on another Chromebook, edit it, and save back to the same Drive file without duplicating or losing the design.

**Delivered:** commit `6d83ee2`, with the structured Drive status card completed in `964499c`.

### Phase 3 — optional cloud autosave

- Only consider this after explicit Save/Open is reliable.
- During a session with valid Drive access, debounce updates to the associated Drive file.
- Clearly distinguish **Saved on this device** from **Saved to Google Drive**.
- Keep manual **Save to Google Drive** available and do not repeatedly display consent prompts.

This phase is optional. Explicit Drive saving is safer and easier to explain for the first classroom release.

### Phase 4 — optional SketchForge recovery service

Only pursue a custom server if schools need recovery when both local storage and Google Drive are unavailable. This would require storage, access codes or authentication, retention/deletion rules, privacy review, monitoring, abuse protection, and ongoing hosting. It is a separate project rather than a prerequisite for Drive saving.

**Estimated implementation:** at least 1–2 weeks plus ongoing operational work.

## Definition of done for the recommended release

- Save to Drive works without first creating a local downloaded file.
- Only the narrow `drive.file` permission is requested.
- The app never contains a Google client secret or persistently stores access tokens.
- A saved Drive project round-trips through the existing version-1 parser without losing editable content.
- Repeated saves update the intended Drive file; Save a copy creates a deliberate duplicate.
- Open from Drive works across two different Chromebooks for the same student.
- Permission, quota, policy, cancellation, expiry, offline, and upload errors are visible and never shown as successful saves.
- Local autosave and `.sketchforge` Download/Open continue to work without Google sign-in.
- The school administrator has approved the production OAuth client for the student organisational unit.
- Type checks, unit tests, static GitHub Pages build, and a managed-Chromebook smoke test all pass before deployment.

## Recommended next action

Complete the remaining **Phase 0 rollout validation** with one school-managed student account and the school's Google Workspace administrator. Confirm save, close, reopen on another Chromebook, update the same Drive file, and the expected error when a shared folder or account is read-only. No custom SketchForge server should be introduced unless that real testing proves Google Drive cannot cover the target students.
