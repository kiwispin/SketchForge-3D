import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

const port = Number(process.env.COLLAB_PORT ?? 3101);
const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const rooms = new Map();

function code() {
  const bytes = randomBytes(8);
  return `${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).slice(0, 4).join("")}-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).slice(4).join("")}`;
}

function normalizeInviteCode(value) {
  const compact = String(value ?? "").toUpperCase().replace(/[^A-Z2-9]/g, "").replace(/[ILO]/g, "").slice(0, 8);
  return compact.length === 8 ? `${compact.slice(0, 4)}-${compact.slice(4)}` : compact;
}

function respond(response, status, body) {
  response.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-allow-headers": "content-type" });
  response.end(JSON.stringify(body));
}

const server = createServer((request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, GET, OPTIONS", "access-control-allow-headers": "content-type" });
    return response.end();
  }
  if (request.method === "GET" && request.url === "/healthz") return respond(response, 200, { ok: true });
  if (request.method !== "POST" || !["/rooms", "/rooms/join"].includes(request.url ?? "")) return respond(response, 404, { error: "Not found" });
  let body = "";
  request.on("data", (chunk) => { body += chunk; });
  request.on("end", () => {
    const payload = JSON.parse(body || "{}");
    if (request.url === "/rooms/join") {
      const room = rooms.get(normalizeInviteCode(payload.code));
      if (!room) return respond(response, 404, { error: "Invite code not found or session has ended" });
      if (typeof payload.name !== "string" || payload.name.trim().length < 2) return respond(response, 400, { error: "A display name is required" });
      return respond(response, 200, { code: room.code, participantId: randomUUID(), snapshot: room.snapshot });
    }
    const { hostName, snapshot } = payload;
    if (typeof hostName !== "string" || hostName.trim().length < 2) return respond(response, 400, { error: "A display name is required" });
    let inviteCode = code();
    while (rooms.has(inviteCode)) inviteCode = code();
    const hostId = randomUUID();
    rooms.set(inviteCode, { code: inviteCode, hostId, snapshot: snapshot ?? null, clients: new Map(), hostDisconnectTimer: null });
    respond(response, 201, { code: inviteCode, participantId: hostId });
  });
});

const websocket = new WebSocketServer({ server, path: "/collaboration" });
websocket.on("connection", (socket, request) => {
  const params = new URL(request.url, "http://lan").searchParams;
  const room = rooms.get(normalizeInviteCode(params.get("code")));
  const participantId = params.get("participantId");
  const name = params.get("name")?.trim();
  if (!room || !participantId || !name) return socket.close(1008, "Invalid invite code");
  if (participantId === room.hostId && room.hostDisconnectTimer) {
    clearTimeout(room.hostDisconnectTimer);
    room.hostDisconnectTimer = null;
  }
  room.clients.set(participantId, { socket, name, role: participantId === room.hostId ? "host" : "guest" });
  socket.send(JSON.stringify({ type: "snapshot", snapshot: room.snapshot, participants: Array.from(room.clients.values(), ({ name, role }) => ({ name, role })) }));
  for (const client of room.clients.values()) client.socket.send(JSON.stringify({ type: "presence", participants: Array.from(room.clients.values(), ({ name, role }) => ({ name, role })) }));
  socket.on("message", (raw) => {
    const message = JSON.parse(raw.toString());
    if (message.type === "replace" && message.snapshot) room.snapshot = message.snapshot;
    if (message.type === "end" && participantId === room.hostId) {
      for (const client of room.clients.values()) client.socket.send(JSON.stringify({ type: "ended", snapshot: room.snapshot }));
      rooms.delete(room.code);
      return;
    }
    for (const [id, client] of room.clients) if (id !== participantId) client.socket.send(JSON.stringify(message));
  });
  socket.on("close", () => {
    // A newer socket may already have reconnected with this participant id.
    // Never let an old socket's delayed close remove that live replacement.
    if (room.clients.get(participantId)?.socket !== socket) return;
    room.clients.delete(participantId);
    if (participantId === room.hostId) {
      // A component remount, refresh, or brief Wi-Fi hiccup must not immediately
      // destroy a student session. The host has one minute to reconnect; explicit
      // `end` remains immediate.
      room.hostDisconnectTimer = setTimeout(() => {
        if (rooms.get(room.code) !== room || room.clients.has(room.hostId)) return;
        for (const client of room.clients.values()) client.socket.send(JSON.stringify({ type: "ended", snapshot: room.snapshot }));
        rooms.delete(room.code);
      }, 60_000);
    }
  });
});

server.listen(port, "0.0.0.0", () => console.log(`SketchForge collaboration service listening on ${port}`));
