/**
 * launch:check — Go/no-go for beta launch.
 * Runs: qa:rep, readiness (with job backlog check), overview/stats, public profile sanity.
 * Usage: pnpm run launch:check
 * Env: BASE_URL (or NEXT_PUBLIC_APP_URL), and for step 5: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Optional: load apps/web/.env.local for local runs (script tries to load it).
 */
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");
const repoRoot = resolve(__dirname, "../..");
const baseUrl =
  process.env.BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

const QUEUED_THRESHOLD = 200;

function loadEnvLocal() {
  const path = resolve(webRoot, ".env.local");
  if (!existsSync(path)) return;
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m && !process.env[m[1]]) {
        const val = m[2].replace(/^["']|["']$/g, "").trim();
        process.env[m[1]] = val;
      }
    }
  } catch {
    /* ignore */
  }
}

loadEnvLocal();

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${url} ${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

type ReadinessBody = {
  ok?: boolean;
  checks?: {
    analyticsQueue?: {
      queued?: number;
      failed?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
};

async function main() {
  console.log("=== Launch check (go/no-go) ===\n");

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

  // 2) /api/readiness + job backlog
  console.log("2) GET", `${baseUrl}/api/readiness`);
  let readiness: ReadinessBody;
  try {
    readiness = await fetchJson<ReadinessBody>(`${baseUrl}/api/readiness`);
    if (!readiness.ok) {
      console.error("   Readiness check failed:", JSON.stringify(readiness, null, 2));
      process.exit(1);
    }
    const q = readiness.checks?.analyticsQueue;
    const queued = q?.queued ?? 0;
    const failed = q?.failed ?? 0;
    if (failed > 0) {
      console.error(`   Job backlog: failed=${failed} (must be 0).`);
      process.exit(1);
    }
    if (queued > QUEUED_THRESHOLD) {
      console.error(`   Job backlog: queued=${queued} (threshold ${QUEUED_THRESHOLD}).`);
      process.exit(1);
    }
    console.log("   Readiness ok. Job queue within threshold.\n");
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
    console.log("");
  } catch (e) {
    console.error("   Overview stats request failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  }

  // 4) Public profile sanity (anon): one published user → 200; optional unpublished → 404
  console.log("4) Public profile sanity (anon)");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
  if (supabaseUrl && serviceKey) {
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, serviceKey);
      const { data: publishedRow } = await supabase
        .from("public_profile_view")
        .select("username")
        .limit(1)
        .maybeSingle();
      const publishedUsername = (publishedRow as { username?: string } | null)?.username?.trim();
      if (publishedUsername) {
        const profileUrl = `${baseUrl}/api/public/profile?username=${encodeURIComponent(publishedUsername)}`;
        const res = await fetch(profileUrl, { cache: "no-store" });
        if (res.status !== 200) {
          console.error(`   Published profile /api/public/profile?username=${publishedUsername} returned ${res.status}, expected 200.`);
          process.exit(1);
        }
        console.log(`   Published profile ?username=${publishedUsername} → 200 ok.`);
      } else {
        console.log("   No published profile in DB; skipping public profile 200 check.");
      }
      const { data: unpublishedRow } = await supabase
        .from("profiles")
        .select("username")
        .eq("published", false)
        .not("username", "is", null)
        .neq("username", "")
        .limit(1)
        .maybeSingle();
      const unpublishedUsername = (unpublishedRow as { username?: string } | null)?.username?.trim();
      if (unpublishedUsername) {
        const res = await fetch(
          `${baseUrl}/api/public/profile?username=${encodeURIComponent(unpublishedUsername)}`,
          { cache: "no-store" }
        );
        if (res.status !== 404 && res.status !== 200) {
          console.error(`   Unpublished profile returned ${res.status}; expected 404 or 200 (empty).`);
          process.exit(1);
        }
        const body = await res.json().catch(() => ({}));
        if (res.status === 200 && body?.profile?.username) {
          console.error("   Unpublished profile was returned with data; public gating may be wrong.");
          process.exit(1);
        }
        console.log(`   Unpublished ?username=${unpublishedUsername} → ${res.status} (gating ok).`);
      }
    } catch (e) {
      console.error("   Public profile sanity failed:", e instanceof Error ? e.message : e);
      process.exit(1);
    }
  } else {
    console.log("   Skip (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set).");
  }

  console.log("\n=== Launch check done (pass) ===");
}

main();
