import { normalizeInviteCode } from "@/lib/collaboration";
import type { WorkplaneShape } from "@/types/sketchforge";

export type CollaborationSnapshot = { name?: string; shapes: WorkplaneShape[] };
export type CollaborationSession = { code: string; participantId: string; name: string; role: "host" | "guest"; lanUrl?: string | null; serviceOrigin?: string };
export type CollaborationParticipant = { name: string; role: "host" | "guest" };

function serviceUrl(path: string) {
  if (typeof window === "undefined") return path;
  if ("__TAURI_INTERNALS__" in window) return `http://127.0.0.1:3101${path}`;
  return `http://${window.location.hostname}:3101${path}`;
}

export async function joinCollaboration(code: string, name: string, serviceOrigin?: string): Promise<{ code: string; participantId: string; snapshot: CollaborationSnapshot; serviceOrigin: string }> {
  const origin = serviceOrigin ?? serviceUrl("");
  const response = await fetch(`${origin}/rooms/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: normalizeInviteCode(code), name: name.trim() }),
  });
  const payload = await response.json() as { error?: string; code?: string; participantId?: string; snapshot?: CollaborationSnapshot };
  if (!response.ok || !payload.code || !payload.participantId || !payload.snapshot || !Array.isArray(payload.snapshot.shapes)) {
    throw new Error(payload.error ?? "Could not join this collaboration session");
  }
  return { code: payload.code, participantId: payload.participantId, snapshot: payload.snapshot, serviceOrigin: origin };
}

export async function startCollaboration(name: string, snapshot: CollaborationSnapshot): Promise<{ code: string; participantId: string; lanUrl?: string | null; serviceOrigin: string }> {
  const origin = serviceUrl("");
  const response = await fetch(`${origin}/rooms`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hostName: name.trim(), snapshot }) });
  const payload = await response.json() as { error?: string; code?: string; participantId?: string; lanUrl?: string | null };
  if (!response.ok || !payload.code || !payload.participantId) throw new Error(payload.error ?? "Could not start collaboration");
  return { code: payload.code, participantId: payload.participantId, lanUrl: payload.lanUrl, serviceOrigin: origin };
}

export function connectCollaboration(session: CollaborationSession, onSnapshot: (snapshot: CollaborationSnapshot) => void, onEnded: () => void, onPresence?: (participants: CollaborationParticipant[]) => void) {
  const base = (session.serviceOrigin ?? serviceUrl("")).replace(/^http/, "ws");
  const socket = new WebSocket(`${base}/collaboration?code=${encodeURIComponent(session.code)}&participantId=${encodeURIComponent(session.participantId)}&name=${encodeURIComponent(session.name)}`);
  let pendingSnapshot: CollaborationSnapshot | null = null;
  const sendPendingSnapshot = () => {
    if (!pendingSnapshot || socket.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify({ type: "replace", snapshot: pendingSnapshot }));
    pendingSnapshot = null;
  };
  socket.addEventListener("open", () => {
    sendPendingSnapshot();
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data) as { type?: string; snapshot?: CollaborationSnapshot; participants?: CollaborationParticipant[] };
    if ((message.type === "snapshot" || message.type === "replace") && message.snapshot) onSnapshot(message.snapshot);
    if ((message.type === "snapshot" || message.type === "presence") && Array.isArray(message.participants)) onPresence?.(message.participants);
    if (message.type === "ended") onEnded();
  });
  return {
    replace: (snapshot: CollaborationSnapshot) => {
      pendingSnapshot = snapshot;
      sendPendingSnapshot();
    },
    end: () => socket.readyState === WebSocket.OPEN && socket.send(JSON.stringify({ type: "end" })),
    close: () => socket.close(),
  };
}
