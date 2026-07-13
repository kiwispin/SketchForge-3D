import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";

const port = Number(process.env.COLLAB_PORT ?? 3101);
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const rooms = new Map();

function code() {
  const bytes = randomBytes(8);
  return `${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).slice(0, 4).join("")}-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).slice(4).join("")}`;
}

function respond(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/healthz") return respond(response, 200, { ok: true });
  if (request.method !== "POST" || request.url !== "/rooms") return respond(response, 404, { error: "Not found" });
  let body = "";
  request.on("data", (chunk) => { body += chunk; });
  request.on("end", () => {
    const { hostName, snapshot } = JSON.parse(body || "{}");
    if (typeof hostName !== "string" || hostName.trim().length < 2) return respond(response, 400, { error: "A display name is required" });
    let inviteCode = code();
    while (rooms.has(inviteCode)) inviteCode = code();
    const hostId = randomUUID();
    rooms.set(inviteCode, { code: inviteCode, hostId, snapshot: snapshot ?? null, clients: new Map() });
    respond(response, 201, { code: inviteCode, participantId: hostId });
  });
});

const websocket = new WebSocketServer({ server, path: "/collaboration" });
websocket.on("connection", (socket, request) => {
  const params = new URL(request.url, "http://lan").searchParams;
  const room = rooms.get(params.get("code")?.toUpperCase());
  const participantId = params.get("participantId");
  const name = params.get("name")?.trim();
  if (!room || !participantId || !name) return socket.close(1008, "Invalid invite code");
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
    room.clients.delete(participantId);
    if (participantId === room.hostId) {
      for (const client of room.clients.values()) client.socket.send(JSON.stringify({ type: "ended", snapshot: room.snapshot }));
      rooms.delete(room.code);
    }
  });
});

server.listen(port, "0.0.0.0", () => console.log(`SketchForge collaboration service listening on ${port}`));
