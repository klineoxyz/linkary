/**
 * launch:check — Run qa:rep, then hit /api/readiness and /api/overview/stats.
 * Usage: pnpm run launch:check [BASE_URL]
 * BASE_URL defaults to http://localhost:3000 or NEXT_PUBLIC_APP_URL from env.
 */
import { execSync } from "child_process";

const repoRoot = process.cwd();
const baseUrl =
  process.env.BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function main() {
  console.log("=== Launch check ===\n");

  // 1) qa:rep
  console.log("1) Running qa:rep ...");
  try {
    execSync("pnpm run qa:rep", {
      cwd: repoRoot,
      stdio: "inherit",
    });
    console.log("   qa:rep passed.\n");
  } catch (e) {
    console.error("   qa:rep failed.");
    process.exit(1);
  }

  // 2) /api/readiness
  console.log("2) GET", `${baseUrl}/api/readiness`);
  try {
    const readiness = await fetchJson<{ ok?: boolean; checks?: unknown }>(
      `${baseUrl}/api/readiness`
    );
    if (!readiness.ok) {
      console.error("   Readiness check failed:", JSON.stringify(readiness, null, 2));
      process.exit(1);
    }
    console.log("   Readiness ok.\n");
  } catch (e) {
    console.error("   Readiness request failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  }

  // 3) /api/overview/stats
  console.log("3) GET", `${baseUrl}/api/overview/stats`);
  try {
    const stats = await fetchJson<Record<string, unknown>>(
      `${baseUrl}/api/overview/stats`
    );
    console.log(JSON.stringify(stats, null, 2));
    console.log("\n=== Launch check done ===");
  } catch (e) {
    console.error("   Overview stats request failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
