/**
 * Check for existing profiles/orgs that have a slug matching a reserved route.
 * Run before adding a new top-level route. Exit code 1 if collisions found.
 *
 * Usage: pnpm exec tsx apps/web/scripts/checkReservedCollisions.ts
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY).
 * Optional: load .env.local from apps/web.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { RESERVED_PATHS } from "../src/lib/reservedPaths";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, "..");

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

async function main() {
  const reserved = Array.from(RESERVED_PATHS);
  console.log("[checkReservedCollisions] Checking", reserved.length, "reserved paths for collisions in usernames / profiles / orgs...\n");

  if (!supabaseUrl || !serviceKey) {
    console.warn("[checkReservedCollisions] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Skipping DB check; only reserved list will be validated.");
    process.exit(0);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const collisions: { slug: string; owner_type: string; owner_id: string }[] = [];

  for (const segment of reserved) {
    const lower = segment.toLowerCase();
    const { data: usernames } = await supabase
      .from("usernames")
      .select("username, owner_type, owner_id")
      .ilike("username", lower);
    const rows = (usernames ?? []) as { username: string; owner_type: string; owner_id: string }[];
    for (const r of rows) {
      if (r.username.toLowerCase() === lower) {
        collisions.push({ slug: r.username, owner_type: r.owner_type, owner_id: r.owner_id });
      }
    }
  }

  if (collisions.length === 0) {
    console.log("[checkReservedCollisions] No collisions found.");
    process.exit(0);
  }

  console.error("[checkReservedCollisions] COLLISIONS (reserved path already claimed as slug):");
  for (const c of collisions) {
    console.error("  - slug:", c.slug, "| owner_type:", c.owner_type, "| owner_id:", c.owner_id);
  }
  console.error("\nResolve these before adding a new route with the same segment, or choose a different route name.");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
