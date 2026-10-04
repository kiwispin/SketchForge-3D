import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DriveError,
  buildMultipartBody,
  downloadDriveProjectFile,
  driveErrorFromResponse,
  driveFileViewUrl,
  escapeDriveQueryValue,
  findOrCreateSketchForgeFolder,
  listDriveProjectFiles,
  uploadProjectToDrive,
} from "@/lib/googleDrive";

type FetchCall = { url: string; init: RequestInit };

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function stubFetchSequence(responses: (Response | Error)[]) {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, init });
      const next = responses.shift();
      if (!next) throw new Error("Unexpected extra fetch call");
      if (next instanceof Error) throw next;
      return next;
    }),
  );
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("driveFileViewUrl", () => {
  it("builds the standard Drive viewer link", () => {
    expect(driveFileViewUrl("abc123")).toBe("https://drive.google.com/file/d/abc123/view");
  });
});

describe("escapeDriveQueryValue", () => {
  it("escapes quotes and backslashes for Drive search queries", () => {
    expect(escapeDriveQueryValue("Maia's design\\test")).toBe("Maia\\'s design\\\\test");
    expect(escapeDriveQueryValue("SketchForge")).toBe("SketchForge");
  });
});

describe("buildMultipartBody", () => {
  it("produces a multipart/related body with metadata and content parts", () => {
    const body = buildMultipartBody({ name: "part.sketchforge" }, '{"format":"sketchforge-project"}', "b1");
    expect(body).toBe(
      [
        "--b1",
        "Content-Type: application/json; charset=UTF-8",
        "",
        '{"name":"part.sketchforge"}',
        "--b1",
        "Content-Type: application/json",
        "",
        '{"format":"sketchforge-project"}',
        "--b1--",
        "",
      ].join("\r\n"),
    );
  });
});

describe("driveErrorFromResponse", () => {
  it("maps expired credentials to an auth error", () => {
    const error = driveErrorFromResponse(401, "");
    expect(error.code).toBe("auth");
    expect(error.message).toContain("expired");
  });

  it("maps a full Drive to a quota error", () => {
    const body = JSON.stringify({ error: { message: "Quota exceeded", errors: [{ reason: "storageQuotaExceeded" }] } });
    const error = driveErrorFromResponse(403, body);
    expect(error.code).toBe("quota");
    expect(error.message).toContain("full");
  });

  it("maps other 403 responses to a permission error", () => {
    const body = JSON.stringify({ error: { message: "Access denied", errors: [{ reason: "insufficientPermissions" }] } });
    const error = driveErrorFromResponse(403, body);
    expect(error.code).toBe("permission");
  });

  it("maps 404 to not-found", () => {
    expect(driveErrorFromResponse(404, "").code).toBe("not-found");
  });

  it("falls back to an unknown error with the Google message when present", () => {
    const error = driveErrorFromResponse(500, JSON.stringify({ error: { message: "Backend unavailable" } }));
    expect(error.code).toBe("unknown");
    expect(error.message).toBe("Backend unavailable");
  });

  it("survives non-JSON error bodies", () => {
    const error = driveErrorFromResponse(500, "<html>oops</html>");
    expect(error.code).toBe("unknown");
  });
});

describe("findOrCreateSketchForgeFolder", () => {
  it("returns the existing folder id when the search finds one", async () => {
    const calls = stubFetchSequence([jsonResponse(200, { files: [{ id: "folder-1" }] })]);
    await expect(findOrCreateSketchForgeFolder("tok")).resolves.toBe("folder-1");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("https://www.googleapis.com/drive/v3/files?q=");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("creates the folder when none exists", async () => {
    const calls = stubFetchSequence([jsonResponse(200, { files: [] }), jsonResponse(200, { id: "folder-new" })]);
    await expect(findOrCreateSketchForgeFolder("tok")).resolves.toBe("folder-new");
    expect(calls).toHaveLength(2);
    expect(calls[1].init.method).toBe("POST");
    expect(JSON.parse(calls[1].init.body as string)).toMatchObject({
      name: "SketchForge",
      mimeType: "application/vnd.google-apps.folder",
    });
  });
});

describe("uploadProjectToDrive", () => {
  const options = { fileName: "Bracket.sketchforge", content: '{"format":"sketchforge-project"}' };

  it("updates the linked file in place when it still exists", async () => {
    const calls = stubFetchSequence([jsonResponse(200, { id: "file-1" })]);
    const result = await uploadProjectToDrive("tok", { ...options, existingFileId: "file-1" });
    expect(result).toEqual({ fileId: "file-1", fileName: "Bracket.sketchforge", replacedMissingFile: false });
    expect(calls[0].init.method).toBe("PATCH");
    expect(calls[0].url).toContain("/upload/drive/v3/files/file-1?uploadType=multipart");
    expect(calls[0].init.body as string).toContain('{"name":"Bracket.sketchforge"}');
  });

  it("creates a fresh file in the SketchForge folder when there is no linked file", async () => {
    const calls = stubFetchSequence([
      jsonResponse(200, { files: [{ id: "folder-1" }] }),
      jsonResponse(200, { id: "file-new" }),
    ]);
    const result = await uploadProjectToDrive("tok", options);
    expect(result).toEqual({ fileId: "file-new", fileName: "Bracket.sketchforge", replacedMissingFile: false });
    expect(calls[1].init.method).toBe("POST");
    expect(calls[1].init.body as string).toContain('"parents":["folder-1"]');
  });

  it("saves a new copy when the linked file has been deleted", async () => {
    const calls = stubFetchSequence([
      jsonResponse(404, { error: { message: "File not found" } }),
      jsonResponse(200, { files: [{ id: "folder-1" }] }),
      jsonResponse(200, { id: "file-replacement" }),
    ]);
    const result = await uploadProjectToDrive("tok", { ...options, existingFileId: "file-gone" });
    expect(result).toEqual({ fileId: "file-replacement", fileName: "Bracket.sketchforge", replacedMissingFile: true });
    expect(calls).toHaveLength(3);
  });

  it("surfaces a quota error when Drive is full", async () => {
    stubFetchSequence([
      jsonResponse(403, { error: { message: "Quota exceeded", errors: [{ reason: "storageQuotaExceeded" }] } }),
    ]);
    await expect(uploadProjectToDrive("tok", { ...options, existingFileId: "file-1" })).rejects.toMatchObject({
      code: "quota",
    });
  });

  it("reports an offline error when the network is unreachable", async () => {
    stubFetchSequence([new TypeError("Failed to fetch")]);
    const failure = await uploadProjectToDrive("tok", options).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(DriveError);
    expect((failure as DriveError).code).toBe("offline");
  });

  it("never reports success when Drive does not confirm the file id", async () => {
    stubFetchSequence([jsonResponse(200, { files: [{ id: "folder-1" }] }), jsonResponse(200, {})]);
    const failure = await uploadProjectToDrive("tok", options).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(DriveError);
    expect((failure as DriveError).code).toBe("unknown");
  });
});

describe("listDriveProjectFiles", () => {
  it("returns only .sketchforge files, newest first as Drive orders them", async () => {
    const calls = stubFetchSequence([
      jsonResponse(200, {
        files: [
          { id: "f1", name: "Bracket.sketchforge", modifiedTime: "2026-07-22T01:00:00.000Z" },
          { id: "f2", name: "notes.txt", modifiedTime: "2026-07-21T01:00:00.000Z" },
          { id: "f3", name: "Rocket.sketchforge.json", modifiedTime: "2026-07-20T01:00:00.000Z" },
          { id: "f4", name: "broken-entry" },
        ],
      }),
    ]);
    const files = await listDriveProjectFiles("tok");
    expect(files.map((file) => file.fileId)).toEqual(["f1", "f3"]);
    expect(files[0]).toEqual({
      fileId: "f1",
      fileName: "Bracket.sketchforge",
      modifiedAt: Date.parse("2026-07-22T01:00:00.000Z"),
    });
    expect(calls[0].url).toContain("orderBy=modifiedTime%20desc");
  });

  it("maps Drive errors when the listing fails", async () => {
    stubFetchSequence([jsonResponse(403, { error: { message: "Access denied", errors: [{ reason: "forbidden" }] } })]);
    await expect(listDriveProjectFiles("tok")).rejects.toMatchObject({ code: "permission" });
  });
});

describe("downloadDriveProjectFile", () => {
  it("downloads the file content as text", async () => {
    const calls = stubFetchSequence([new Response('{"format":"sketchforge-project"}', { status: 200 })]);
    await expect(downloadDriveProjectFile("tok", "file-1")).resolves.toBe('{"format":"sketchforge-project"}');
    expect(calls[0].url).toContain("/files/file-1?alt=media");
  });

  it("maps a deleted file to not-found", async () => {
    stubFetchSequence([jsonResponse(404, { error: { message: "File not found" } })]);
    await expect(downloadDriveProjectFile("tok", "file-gone")).rejects.toMatchObject({ code: "not-found" });
  });
});
