import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [
  spawn(process.execPath, ["scripts/collaboration-server.mjs"], {
    env: { ...process.env, COLLAB_PORT: process.env.COLLAB_PORT ?? "3101" },
    stdio: "inherit",
  }),
  // Windows cannot directly spawn npm.cmd without a shell (EINVAL).
  spawn(npm, ["run", "dev", "--", "--hostname", "0.0.0.0"], { stdio: "inherit", shell: process.platform === "win32" }),
];

function stop(exitCode = 0) {
  for (const child of children) child.kill("SIGTERM");
  process.exit(exitCode);
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
for (const child of children) child.on("exit", (code) => stop(code ?? 1));
