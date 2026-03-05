/**
 * XSpaces runtime smoke: ensures /xspaces loads.
 * Run after build from apps/web: pnpm run smoke:xspaces
 * Or from repo root: pnpm --filter web run smoke:xspaces
 *
 * - Starts production server (next start) on PORT 3001 to avoid clashes with dev
 * - GET /xspaces: accepts 200 (OK) or 302/307 (redirect to login)
 * - If 200: asserts HTML looks like the app (e.g. __NEXT_DATA__ or xspaces route); sidebar text may be client-only
 * - No auth, no OAuth, no fixture data required
 */
import { spawn, type ChildProcess } from "child_process";
import { join } from "path";

const PORT = Number(process.env.XSPACES_SMOKE_PORT) || 3001;
const BASE = `http://localhost:${PORT}`;
const WAIT_MS = 30_000;
const POLL_MS = 500;

function waitForServer(): Promise<void> {
  const deadline = Date.now() + WAIT_MS;
  return new Promise((resolve, reject) => {
    const tick = () => {
      fetch(`${BASE}/xspaces`, { redirect: "manual" })
        .then((r) => {
          if (r.status === 200 || r.status === 302 || r.status === 307) {
            resolve();
            return;
          }
          if (Date.now() >= deadline) {
            reject(new Error(`Server did not respond with 200/302/307 within ${WAIT_MS}ms`));
            return;
          }
          setTimeout(tick, POLL_MS);
        })
        .catch((e) => {
          if (Date.now() >= deadline) reject(e);
          else setTimeout(tick, POLL_MS);
        });
    };
    tick();
  });
}

async function main(): Promise<number> {
  const cwd = process.cwd();
  const webDir = cwd.endsWith("web") ? cwd : join(cwd, "apps", "web");

  let child: ChildProcess | null = null;
  const nextBin = join(webDir, "node_modules", "next", "dist", "bin", "next");
  console.log(`Starting server on port ${PORT} (cwd: ${webDir})...`);
  child = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
    cwd: webDir,
    stdio: "pipe",
    env: { ...process.env, PORT: String(PORT) },
  });
  child.stderr?.on("data", (d) => process.stderr.write(d));
  child.stdout?.on("data", (d) => process.stdout.write(d));

  const kill = () => {
    if (child?.pid) {
      try {
        process.kill(child.pid, "SIGTERM");
      } catch {
        // ignore
      }
      child = null;
    }
  };
  process.on("SIGINT", kill);
  process.on("SIGTERM", kill);

  let exitCode = 0;
  try {
    await waitForServer();
    const res = await fetch(`${BASE}/xspaces`, { redirect: "manual" });
    if (res.status !== 200 && res.status !== 302 && res.status !== 307) {
      console.error(`Unexpected status: ${res.status}`);
      exitCode = 1;
    } else if (res.status === 200) {
      const html = await res.text();
      const hasAppShell =
        html.includes("__NEXT_DATA__") ||
        html.includes("xspaces") ||
        html.includes("X Spaces") ||
        html.includes("Calendar");
      if (!hasAppShell) {
        console.error("Response body does not look like the app (no __NEXT_DATA__, xspaces, or sidebar text)");
        exitCode = 1;
      }
    }
    if (exitCode === 0) {
      console.log("XSpaces smoke passed: page loads or redirects to login.");
    }
  } catch (e) {
    console.error(e);
    exitCode = 1;
  } finally {
    kill();
    setTimeout(() => process.exit(exitCode), 400);
  }
  return exitCode;
}

main();
