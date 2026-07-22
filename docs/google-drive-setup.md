# Save to Google Drive — Setup Guide

SketchForge can save `.sketchforge` projects straight from the browser into the
student's own Google Drive (`My Drive → SketchForge`). No SketchForge server is
involved: the browser talks directly to Google with the narrow `drive.file`
permission, which only allows access to files SketchForge itself creates.

The feature is **hidden until a Google OAuth Client ID is configured**. Without
it, the app behaves exactly as before (local autosave + Download).

## One-time Google Cloud setup (~15 minutes)

Whoever owns the deployment (you, or the school's IT admin) does this once:

1. Go to <https://console.cloud.google.com/> and create (or select) a project,
   e.g. **SketchForge**.
2. **Enable the Drive API:** APIs & Services → Library → search "Google Drive
   API" → Enable.
3. **Configure the consent screen:** APIs & Services → OAuth consent screen.
   - If the Google Cloud project is owned by the school's Workspace domain,
     choose **Internal** — only accounts in that domain can use it, and no
     Google verification review is needed.
   - Otherwise choose **External**. App name "SketchForge", your support email.
     While the app is in "Testing" status only listed test users can sign in;
     publish it (or add the class accounts as test users) before rollout.
   - Scopes: you do not need to add any sensitive scopes; `drive.file` is
     non-sensitive.
4. **Create the client ID:** APIs & Services → Credentials → Create
   Credentials → **OAuth client ID** → Application type **Web application**.
   - Name: e.g. `SketchForge web`.
   - **Authorised JavaScript origins:**
     - `https://kiwispin.github.io`
     - `http://localhost:3000` (for local development)
   - No redirect URIs are needed (the token flow is popup-based).
5. Copy the **Client ID** (looks like
   `1234567890-abc123.apps.googleusercontent.com`). There is **no client
   secret** anywhere in this setup — do not create or embed one.

### Managed school Chromebooks

If the school restricts third-party app access, ask the Google Workspace
administrator to allowlist the client ID: Admin console → Security → API
controls → App access control → add the client ID and trust it for the Drive
scope. Also confirm pop-ups are allowed for the app's origin, since Google
sign-in opens a pop-up.

## Wiring the client ID into SketchForge

The app reads the ID from the public build-time variable
`NEXT_PUBLIC_GOOGLE_CLIENT_ID` (it is public configuration, safe to expose).

- **Local development:** create `apps/web/.env.local` (it must sit in the app
  directory, not the repo root, because the dev command is `next dev apps/web`)
  with:

  ```bash
  NEXT_PUBLIC_GOOGLE_CLIENT_ID=1234567890-abc123.apps.googleusercontent.com
  ```

  then `npm run dev`.

- **GitHub Pages deployment:** in the GitHub repo, go to Settings → Secrets
  and variables → Actions → **Variables** tab → New repository variable:
  - Name: `GOOGLE_OAUTH_CLIENT_ID`
  - Value: the client ID
  The Pages workflow passes it into the build automatically. Re-run the deploy
  (push to `main` or trigger the workflow) to pick it up.

## What students see

- The editor's **Export** panel gains a **Save to Google Drive** button above
  the download options. The first press opens Google sign-in and asks to
  approve SketchForge; the file is then uploaded to `My Drive → SketchForge`.
- Later saves update the **same Drive file** (no duplicates). The panel shows
  the linked file name with **View in Drive** and **Save a copy** actions.
- If Drive is full, blocked by school policy, offline, or sign-in is
  cancelled, the design stays open, an accurate message is shown, and
  **Download project** remains available. A save is never reported as
  successful unless Google confirmed it.
- Access tokens are held only in memory for the session; nothing Google-related
  is stored beyond the Drive file name/ID linked to the project.
