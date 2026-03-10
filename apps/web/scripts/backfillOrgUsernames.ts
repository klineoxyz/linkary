/**
 * One-time backfill: insert into usernames for each org that has a slug but no row.
 * SAFE TO RUN ONLY AFTER resolving profile/org slug collisions (see LINKARY_NAMESPACE_REMEDIATION_AND_BACKFILL_PLAN.md).
 * Exits with code 1 if any collision exists; does not insert in that case.
 *
 * Usage: pnpm exec tsx apps/web/scripts/backfillOrgUsernames.ts
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY).
 * Optional: load .env.local from apps/web.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

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

function normalize(s: string): string {
  return (s ?? "").trim().toLowerCase().replace(/^@/, "");
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

  console.log("[backfillOrgUsernames] One-time backfill of org slugs into usernames.\n");

  if (!supabaseUrl || !serviceKey) {
    console.error("[backfillOrgUsernames] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Aborting.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1) Collision check (same as audit script) – abort if any
  const { data: profiles } = await supabase.from("profiles").select("id, username, twitter_username");
  const profileSlugToId = new Map<string, string>();
  for (const p of profiles ?? []) {
    const row = p as { id: string; username?: string | null; twitter_username?: string | null };
    const u = row.username ? normalize(row.username) : "";
    const t = row.twitter_username ? normalize(row.twitter_username) : "";
    if (u) profileSlugToId.set(u, row.id);
    if (t && !profileSlugToId.has(t)) profileSlugToId.set(t, row.id);
  }

  const { data: orgs } = await supabase.from("orgs").select("id, slug");
  const orgSlugs = new Map<string, string>();
  for (const o of orgs ?? []) {
    const row = o as { id: string; slug?: string | null };
    const s = row.slug ? normalize(row.slug) : "";
    if (s) orgSlugs.set(s, row.id);
  }

  const collisions: { slug: string; profileId: string; orgId: string }[] = [];
  for (const [slug, orgId] of orgSlugs) {
    const profileId = profileSlugToId.get(slug);
    if (profileId) collisions.push({ slug, profileId, orgId });
  }

  if (collisions.length > 0) {
    console.error("[backfillOrgUsernames] ABORT: Profile/org collisions detected. Resolve before backfill.");
    for (const c of collisions) {
      console.error("  slug:", c.slug, "| profileId:", c.profileId, "| orgId:", c.orgId);
    }
    console.error("\nRun remediation (see LINKARY_NAMESPACE_REMEDIATION_AND_BACKFILL_PLAN.md), then re-run audit, then this script.");
    process.exit(1);
  }

  // 2) Current usernames by slug
  const { data: usernames } = await supabase.from("usernames").select("username, owner_type, owner_id");
  const usernamesBySlug = new Map<string, { owner_type: string; owner_id: string }[]>();
  for (const u of usernames ?? []) {
    const row = u as { username: string; owner_type: string; owner_id: string };
    const s = normalize(row.username);
    if (!s) continue;
    const list = usernamesBySlug.get(s) ?? [];
    list.push({ owner_type: row.owner_type, owner_id: row.owner_id });
    usernamesBySlug.set(s, list);
  }

  let inserted = 0;
  let skippedAlreadyPresent = 0;
  let skippedSlugTaken = 0;

  const insertedRows: { username: string; owner_id: string }[] = [];

  for (const [slug, orgId] of orgSlugs) {
    const list = usernamesBySlug.get(slug);
    const hasOrgRow = list?.some((o) => o.owner_type === "org" && o.owner_id === orgId);
    if (hasOrgRow) {
      skippedAlreadyPresent++;
      continue;
    }
    const takenByOther = list && list.length > 0;
    if (takenByOther) {
      console.log("[backfillOrgUsernames] Skip org", orgId, "slug", slug, "(slug already owned by another)");
      skippedSlugTaken++;
      continue;
    }

    const { error } = await supabase.from("usernames").insert({
      username: slug,
      owner_type: "org",
      owner_id: orgId,
      provider: null,
      verified_at: null,
    });

    if (error) {
      console.error("[backfillOrgUsernames] Insert failed for org", orgId, "slug", slug, ":", error.message);
      process.exit(1);
    }
    inserted++;
    insertedRows.push({ username: slug, owner_id: orgId });
    // Update local map so a duplicate slug in orgs list would see it
    const next = usernamesBySlug.get(slug) ?? [];
    next.push({ owner_type: "org", owner_id: orgId });
    usernamesBySlug.set(slug, next);
  }

  console.log("[backfillOrgUsernames] Done. Inserted:", inserted, "| Skipped (already present):", skippedAlreadyPresent, "| Skipped (slug taken):", skippedSlugTaken);
  if (insertedRows.length > 0) {
    console.log("[backfillOrgUsernames] Inserted rows (for rollback reference):");
    for (const r of insertedRows) {
      console.log("  ", r.username, r.owner_id);
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
