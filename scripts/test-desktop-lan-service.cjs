/*
 * Smoke test for the LAN service bundled in the desktop application.
 * Start SketchForge LAN first, then run: npm run test:desktop:service
 */
const { WebSocket } = require("ws");

const origin = process.env.SKETCHFORGE_LAN_ORIGIN ?? "http://127.0.0.1:3101";
const timeout = (message) => new Promise((_, reject) => setTimeout(() => reject(new Error(message)), 5_000));

async function request(path, body) {
  const response = await fetch(`${origin}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? `${path} failed`);
  return payload;
}

function openSocket(path) {
  const socket = new WebSocket(`${origin.replace(/^http/, "ws")}${path}`);
  const messages = [];
  socket.on("message", (raw) => messages.push(JSON.parse(raw.toString())));
  return new Promise((resolve, reject) => {
    socket.once("open", () => resolve({ socket, messages }));
    socket.once("error", reject);
  });
}

async function nextMessage(connection, type) {
  const existing = connection.messages.find((message) => message.type === type);
  if (existing) return existing;
  return Promise.race([
    new Promise((resolve) => {
      const interval = setInterval(() => {
        const message = connection.messages.find((entry) => entry.type === type);
        if (message) {
          clearInterval(interval);
          resolve(message);
        }
      }, 20);
    }),
    timeout(`Timed out waiting for ${type}`),
  ]);
}

async function main() {
  const initial = { name: "Desktop test", shapes: [{ id: "before", type: "box" }] };
  const room = await request("/rooms", { hostName: "Host student", snapshot: initial });
  const joined = await request("/rooms/join", { code: room.code, name: "Guest student" });
  if (joined.snapshot.shapes[0]?.id !== "before") throw new Error("Guest did not receive the initial snapshot");

  const host = await openSocket(`/collaboration?code=${room.code}&participantId=${room.participantId}&name=Host%20student`);
  const guest = await openSocket(`/collaboration?code=${room.code}&participantId=${joined.participantId}&name=Guest%20student`);
  await nextMessage(guest, "snapshot");

  const changed = { name: "Desktop test", shapes: [{ id: "after", type: "cylinder" }] };
  guest.socket.send(JSON.stringify({ type: "replace", snapshot: changed }));
  const forward = await nextMessage(host, "replace");
  if (forward.snapshot?.shapes?.[0]?.id !== "after") throw new Error("Guest-to-host update was not relayed");

  host.socket.send(JSON.stringify({ type: "replace", snapshot: initial }));
  const backward = await nextMessage(guest, "replace");
  if (backward.snapshot?.shapes?.[0]?.id !== "before") throw new Error("Host-to-guest reverse update was not relayed");

  host.socket.send(JSON.stringify({ type: "end" }));
  await nextMessage(guest, "ended");
  host.socket.close();
  guest.socket.close();
  console.log("Desktop LAN service passed: join, guest-to-host update, host-to-guest reverse update, and end session.");
}

main().catch((error) => {
  console.error(`Desktop LAN service failed: ${error.message}`);
  process.exitCode = 1;
});
