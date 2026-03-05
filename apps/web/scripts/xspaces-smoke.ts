/**
 * XSpaces runtime smoke: ensures /xspaces (or XSPACES_SMOKE_PATH) loads.
 * Run after build from apps/web: pnpm run smoke:xspaces
 * Or from repo root: pnpm --filter web run smoke:xspaces
 *
 * Env:
 *   XSPACES_SMOKE_PORT     - port when spawning server (default 3001)
 *   XSPACES_SMOKE_URL_BASE - if set, smoke this base URL (no spawn); e.g. https://staging.example.com
 *   XSPACES_SMOKE_PATH    - path to request (default /xspaces)
 *
 * Timeouts: boot 30s, request 5s per attempt, overall 60s.
 * Always kills child and exits with 0 or 1. CI-safe.
 */
import { spawn, type ChildProcess } from "child_process";
import { join } from "path";

const PORT = Number(process.env.XSPACES_SMOKE_PORT) || 3001;
const URL_BASE = process.env.XSPACES_SMOKE_URL_BASE ?? "";
const PATH = process.env.XSPACES_SMOKE_PATH ?? "/xspaces";
const BASE = URL_BASE || `http://localhost:${PORT}`;
const BOOT_TIMEOUT_MS = 30_000;
const REQUEST_TIMEOUT_MS = 5_000;
const OVERALL_TIMEOUT_MS = 60_000;

function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  return fetch(url, { redirect: "manual", signal: ac.signal }).finally(() => clearTimeout(t));
}

function waitForServer(): Promise<void> {
  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  let delayMs = 200;
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (Date.now() >= deadline) {
        reject(new Error(`Server did not respond with 200/302/307 within ${BOOT_TIMEOUT_MS}ms`));
        return;
      }
      fetchWithTimeout(`${BASE}${PATH}`, REQUEST_TIMEOUT_MS)
        .then((r) => {
          if (r.status === 200 || r.status === 302 || r.status === 307) {
            resolve();
            return;
          }
          setTimeout(tick, Math.min(delayMs, 2000));
          delayMs = Math.min(delayMs * 1.5, 2000);
        })
        .catch((e) => {
          if (Date.now() >= deadline) reject(e);
          else {
            setTimeout(tick, Math.min(delayMs, 2000));
            delayMs = Math.min(delayMs * 1.5, 2000);
          }
        });
    };
    tick();
  });
}

function assertBody(html: string): { ok: boolean; msg?: string } {
  const hasTestId =
    html.includes('data-testid="xspaces-shell"') ||
    html.includes('data-testid="xspaces-sidebar"') ||
    html.includes('data-testid="xspaces-nav-calendar"');
  const hasSidebarText =
    html.includes("Home") || html.includes("Explore") || html.includes("Calendar");
  const hasNext = html.includes("__NEXT_DATA__") || html.includes("xspaces");
  if (hasTestId || (hasSidebarText && hasNext) || hasNext) return { ok: true };
  return {
    ok: false,
    msg: "Response missing data-testid (xspaces-shell/sidebar/nav-calendar), sidebar text (Home/Explore/Calendar), or __NEXT_DATA__/xspaces",
  };
}

async function main(): Promise<number> {
  const overallDeadline = Date.now() + OVERALL_TIMEOUT_MS;
  const cwd = process.cwd();
  const webDir = cwd.endsWith("web") ? cwd : join(cwd, "apps", "web");

  let child: ChildProcess | null = null;
  const kill = () => {
    if (child?.pid) {
      try {
        process.kill(child.pid, "SIGTERM");
      } catch {
        /* ignore */
      }
      child = null;
    }
  };

  const exit = (code: number) => {
    kill();
    setTimeout(() => process.exit(code), 400);
  };

  process.on("SIGINT", () => {
    console.error("Smoke interrupted (SIGINT)");
    exit(130);
  });
  process.on("SIGTERM", () => {
    console.error("Smoke interrupted (SIGTERM)");
    exit(143);
  });

  if (!URL_BASE) {
    const nextBin = join(webDir, "node_modules", "next", "dist", "bin", "next");
    console.log(`[xspaces-smoke] Starting server on port ${PORT} (cwd: ${webDir})...`);
    child = spawn(process.execPath, [nextBin, "start", "-p", String(PORT)], {
      cwd: webDir,
      stdio: "pipe",
      env: { ...process.env, PORT: String(PORT) },
    });
    child.stderr?.on("data", (d) => process.stderr.write(d));
    child.stdout?.on("data", (d) => process.stdout.write(d));
  } else {
    console.log(`[xspaces-smoke] Using external base: ${URL_BASE}${PATH}`);
  }

  let exitCode = 0;
  const run = async () => {
    if (Date.now() >= overallDeadline) throw new Error("Overall timeout exceeded before starting");
    await waitForServer();
    if (Date.now() >= overallDeadline) throw new Error("Overall timeout exceeded after boot");
    const res = await fetchWithTimeout(`${BASE}${PATH}`, REQUEST_TIMEOUT_MS);
    if (res.status !== 200 && res.status !== 302 && res.status !== 307) {
      console.error(`[xspaces-smoke] FAIL: Unexpected status ${res.status}`);
      return 1;
    }
    if (res.status === 200) {
      const html = await res.text();
      const result = assertBody(html);
      if (!result.ok) {
        console.error(`[xspaces-smoke] FAIL: ${result.msg}`);
        return 1;
      }
    }
    console.log("[xspaces-smoke] PASS: Page loads or redirects to login (200/302/307).");
    return 0;
  };
  let overallTimer: ReturnType<typeof setTimeout> | null = null;
  const overallTimeout = new Promise<number>((_, reject) => {
    overallTimer = setTimeout(
      () => reject(new Error(`Overall timeout (${OVERALL_TIMEOUT_MS}ms) exceeded`)),
      OVERALL_TIMEOUT_MS
    );
  });
  try {
    exitCode = await Promise.race([run(), overallTimeout]);
    if (overallTimer) clearTimeout(overallTimer);
  } catch (e) {
    if (overallTimer) clearTimeout(overallTimer);
    console.error("[xspaces-smoke] FAIL:", e instanceof Error ? e.message : e);
    exitCode = 1;
  } finally {
    exit(exitCode);
  }
  return exitCode;
}

main();
