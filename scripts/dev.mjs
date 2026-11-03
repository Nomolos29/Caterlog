import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const detached = process.platform !== "win32";

const children = [
  spawn(npm, ["run", "dev:api"], { stdio: "inherit", detached }),
  spawn(npm, ["run", "dev:dashboard"], { stdio: "inherit", detached }),
];

let shuttingDown = false;

function signalChild(child, signal) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  try {
    // Detached children lead their own process group, so signal the whole tree
    // (npm -> sh -> node/next) instead of only the npm wrapper.
    if (detached && child.pid) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch {
    // The child may have exited between the check and the signal.
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) signalChild(child, "SIGTERM");
  setTimeout(() => {
    for (const child of children) signalChild(child, "SIGKILL");
    process.exit(code);
  }, 1500);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

for (const child of children) {
  child.on("exit", (code) => {
    if (!shuttingDown) shutdown(code ?? 0);
  });
}
