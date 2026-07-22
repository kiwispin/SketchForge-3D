import { isProjectFileName } from "@/lib/projectFile";

// Direct browser-to-Google-Drive saving for .sketchforge projects.
//
// Uses the Google Identity Services (GIS) token flow with only the narrow
// `drive.file` scope, so SketchForge can touch files it created (or files the
// student explicitly picks) and nothing else. There is no client secret in
// the app and access tokens live only in memory for the current session.

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const DRIVE_FOLDER_NAME = "SketchForge";
const DRIVE_FOLDER_MIME = "application/vnd.google-apps.folder";
const PROJECT_FILE_MIME = "application/json";
const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";

const DRIVE_CLIENT_ID = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "").trim();

export type DriveErrorCode =
  | "not-configured"
  | "cancelled"
  | "offline"
  | "auth"
  | "permission"
  | "quota"
  | "not-found"
  | "unknown";

export class DriveError extends Error {
  code: DriveErrorCode;

  constructor(code: DriveErrorCode, message: string) {
    super(message);
    this.name = "DriveError";
    this.code = code;
  }
}

export type DriveSaveResult = {
  fileId: string;
  fileName: string;
  replacedMissingFile: boolean;
};

export function isDriveConfigured() {
  return DRIVE_CLIENT_ID.length > 0;
}

export function driveFileViewUrl(fileId: string) {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/view`;
}

export function escapeDriveQueryValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function buildMultipartBody(metadata: object, content: string, boundary: string) {
  return [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${PROJECT_FILE_MIME}`,
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

export function driveErrorFromResponse(status: number, bodyText: string): DriveError {
  let reason = "";
  let message = "";
  try {
    const parsed = JSON.parse(bodyText) as {
      error?: { message?: string; errors?: { reason?: string }[] };
    };
    message = parsed.error?.message ?? "";
    reason = parsed.error?.errors?.[0]?.reason ?? "";
  } catch {
    // Non-JSON error body; fall through to status-based mapping.
  }
  if (status === 401) {
    return new DriveError("auth", "Google Drive access expired — press Save to Drive again");
  }
  if (status === 403 && (reason === "storageQuotaExceeded" || /quota/i.test(message))) {
    return new DriveError("quota", "Google Drive is full — free up space or use Download");
  }
  if (status === 403) {
    return new DriveError("permission", "Google Drive blocked the save — use Download instead");
  }
  if (status === 404) {
    return new DriveError("not-found", "The saved Google Drive file could not be found");
  }
  return new DriveError("unknown", message || "Google Drive error — try again or use Download");
}

// --- Google Identity Services -----------------------------------------------

type DriveTokenResponse = {
  access_token?: string;
  expires_in?: number | string;
  error?: string;
  error_description?: string;
};

type DriveTokenClient = { requestAccessToken: (overrides?: { prompt?: string }) => void };

type GoogleIdentityWindow = Window & {
  google?: {
    accounts?: {
      oauth2?: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (response: DriveTokenResponse) => void;
          error_callback?: (error: { type?: string; message?: string }) => void;
        }) => DriveTokenClient;
      };
    };
  };
};

let gisLoadPromise: Promise<void> | null = null;
let cachedToken: { token: string; expiresAt: number } | null = null;

function clearCachedDriveToken() {
  cachedToken = null;
}

export function preloadGoogleIdentity(): Promise<void> {
  if (typeof document === "undefined") {
    return Promise.resolve();
  }
  if (!gisLoadPromise) {
    gisLoadPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`);
      if (existing && (window as GoogleIdentityWindow).google?.accounts?.oauth2) {
        resolve();
        return;
      }
      const script = existing instanceof HTMLScriptElement ? existing : document.createElement("script");
      script.addEventListener("load", () => resolve(), { once: true });
      script.addEventListener(
        "error",
        () => {
          gisLoadPromise = null;
          reject(new DriveError("offline", "Could not load Google sign-in — check the connection"));
        },
        { once: true },
      );
      if (!(existing instanceof HTMLScriptElement)) {
        script.src = GIS_SCRIPT_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
    });
  }
  return gisLoadPromise;
}

export async function requestDriveAccessToken(): Promise<string> {
  if (!isDriveConfigured()) {
    throw new DriveError("not-configured", "Google Drive saving isn't set up for this SketchForge build yet.");
  }
  if (cachedToken && cachedToken.expiresAt - 30_000 > Date.now()) {
    return cachedToken.token;
  }
  await preloadGoogleIdentity();
  const oauth2 = (window as GoogleIdentityWindow).google?.accounts?.oauth2;
  if (!oauth2) {
    throw new DriveError("unknown", "Google sign-in could not start — reload and try again");
  }
  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: DRIVE_CLIENT_ID,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (!response.access_token) {
          reject(
            response.error === "access_denied"
              ? new DriveError("cancelled", "Google Drive access was cancelled — nothing saved")
              : new DriveError("unknown", response.error_description || "Google sign-in failed. Try again."),
          );
          return;
        }
        const expiresInSeconds = Number(response.expires_in) || 3600;
        cachedToken = { token: response.access_token, expiresAt: Date.now() + expiresInSeconds * 1000 };
        resolve(response.access_token);
      },
      error_callback: (error) => {
        if (error?.type === "popup_failed_to_open") {
          reject(new DriveError("cancelled", "Sign-in pop-up blocked — allow pop-ups for this site"));
          return;
        }
        reject(new DriveError("cancelled", "Google Drive access was cancelled — nothing saved"));
      },
    });
    client.requestAccessToken();
  });
}

// --- Drive REST calls -------------------------------------------------------

async function driveFetch(token: string, url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new DriveError("offline", "Could not reach Google Drive — check the connection");
  }
  if (response.status === 401) {
    // Session token no longer valid; the next explicit Drive action re-prompts.
    clearCachedDriveToken();
  }
  return response;
}

export async function findOrCreateSketchForgeFolder(token: string): Promise<string> {
  const query = `name = '${escapeDriveQueryValue(DRIVE_FOLDER_NAME)}' and mimeType = '${DRIVE_FOLDER_MIME}' and 'root' in parents and trashed = false`;
  const searchUrl = `${DRIVE_FILES_URL}?q=${encodeURIComponent(query)}&fields=${encodeURIComponent("files(id)")}&spaces=drive`;
  const searchResponse = await driveFetch(token, searchUrl, { method: "GET" });
  if (!searchResponse.ok) {
    throw driveErrorFromResponse(searchResponse.status, await searchResponse.text());
  }
  const searchPayload = (await searchResponse.json().catch(() => null)) as { files?: { id?: string }[] } | null;
  const existingId = searchPayload?.files?.[0]?.id;
  if (existingId) {
    return existingId;
  }

  const createResponse = await driveFetch(token, `${DRIVE_FILES_URL}?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: DRIVE_FOLDER_MIME }),
  });
  if (!createResponse.ok) {
    throw driveErrorFromResponse(createResponse.status, await createResponse.text());
  }
  const created = (await createResponse.json().catch(() => null)) as { id?: string } | null;
  if (!created?.id) {
    throw new DriveError("unknown", "Google Drive did not return the SketchForge folder.");
  }
  return created.id;
}

export async function uploadProjectToDrive(
  token: string,
  options: { fileName: string; content: string; existingFileId?: string | null },
): Promise<DriveSaveResult> {
  const boundary = `sketchforge-${Math.random().toString(36).slice(2)}`;
  const multipartHeaders = { "Content-Type": `multipart/related; boundary=${boundary}` };

  if (options.existingFileId) {
    const body = buildMultipartBody({ name: options.fileName }, options.content, boundary);
    const response = await driveFetch(
      token,
      `${DRIVE_UPLOAD_URL}/${encodeURIComponent(options.existingFileId)}?uploadType=multipart&fields=id`,
      { method: "PATCH", headers: multipartHeaders, body },
    );
    if (response.ok) {
      return { fileId: options.existingFileId, fileName: options.fileName, replacedMissingFile: false };
    }
    if (response.status !== 404) {
      throw driveErrorFromResponse(response.status, await response.text());
    }
    // The linked Drive file was deleted or is no longer reachable — save the
    // design as a new file instead of failing.
  }

  const folderId = await findOrCreateSketchForgeFolder(token);
  const body = buildMultipartBody(
    {
      name: options.fileName,
      parents: [folderId],
      mimeType: PROJECT_FILE_MIME,
      appProperties: { sketchforgeProject: "true" },
    },
    options.content,
    boundary,
  );
  const response = await driveFetch(token, `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: multipartHeaders,
    body,
  });
  if (!response.ok) {
    throw driveErrorFromResponse(response.status, await response.text());
  }
  const payload = (await response.json().catch(() => null)) as { id?: string } | null;
  if (!payload?.id) {
    throw new DriveError("unknown", "Google Drive did not confirm the save.");
  }
  return { fileId: payload.id, fileName: options.fileName, replacedMissingFile: Boolean(options.existingFileId) };
}

export async function saveProjectToDrive(options: {
  fileName: string;
  content: string;
  existingFileId?: string | null;
}): Promise<DriveSaveResult> {
  const token = await requestDriveAccessToken();
  return uploadProjectToDrive(token, options);
}

export type DriveProjectFileInfo = { fileId: string; fileName: string; modifiedAt: number };

// With the drive.file scope this only ever sees files SketchForge itself
// created (on any device), so no filtering beyond the extension is needed.
export async function listDriveProjectFiles(token: string): Promise<DriveProjectFileInfo[]> {
  const query = "trashed = false and mimeType != 'application/vnd.google-apps.folder'";
  const url =
    `${DRIVE_FILES_URL}?q=${encodeURIComponent(query)}` +
    `&fields=${encodeURIComponent("files(id,name,modifiedTime)")}` +
    `&orderBy=${encodeURIComponent("modifiedTime desc")}&pageSize=100&spaces=drive`;
  const response = await driveFetch(token, url, { method: "GET" });
  if (!response.ok) {
    throw driveErrorFromResponse(response.status, await response.text());
  }
  const payload = (await response.json().catch(() => null)) as {
    files?: { id?: string; name?: string; modifiedTime?: string }[];
  } | null;
  return (payload?.files ?? [])
    .filter((file) => typeof file.id === "string" && typeof file.name === "string" && isProjectFileName(file.name))
    .map((file) => ({
      fileId: file.id as string,
      fileName: file.name as string,
      modifiedAt: Date.parse(file.modifiedTime ?? "") || 0,
    }));
}

export async function downloadDriveProjectFile(token: string, fileId: string): Promise<string> {
  const response = await driveFetch(token, `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?alt=media`, {
    method: "GET",
  });
  if (!response.ok) {
    throw driveErrorFromResponse(response.status, await response.text());
  }
  return response.text();
}

export async function listProjectsFromDrive(): Promise<DriveProjectFileInfo[]> {
  const token = await requestDriveAccessToken();
  return listDriveProjectFiles(token);
}

export async function downloadProjectFromDrive(fileId: string): Promise<string> {
  const token = await requestDriveAccessToken();
  return downloadDriveProjectFile(token, fileId);
}
