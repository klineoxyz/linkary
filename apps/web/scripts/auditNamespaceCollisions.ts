/**
 * Audit global namespace: report slugs that exist in both profiles and orgs (collisions).
 * Read-only. Run before enforcing single-namespace (see LINKARY_FINAL_URL_ARCHITECTURE_AND_NAMESPACE_PLAN.md).
 *
 * Usage: pnpm exec tsx apps/web/scripts/auditNamespaceCollisions.ts
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

  console.log("[auditNamespaceCollisions] Global namespace audit (read-only)...\n");

  if (!supabaseUrl || !serviceKey) {
    console.warn("[auditNamespaceCollisions] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Skipping.");
    process.exit(0);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // 1) All profile usernames (and twitter_username) normalized
  const { data: profiles } = await supabase.from("profiles").select("id, username, twitter_username");
  const profileSlugs = new Map<string, { id: string; source: "username" | "twitter_username" }>();
  for (const p of profiles ?? []) {
    const row = p as { id: string; username?: string | null; twitter_username?: string | null };
    const u = row.username ? normalize(row.username) : "";
    const t = row.twitter_username ? normalize(row.twitter_username) : "";
    if (u) profileSlugs.set(u, { id: row.id, source: "username" });
    if (t && !profileSlugs.has(t)) profileSlugs.set(t, { id: row.id, source: "twitter_username" });
  }

  // 2) All org slugs normalized
  const { data: orgs } = await supabase.from("orgs").select("id, slug");
  const orgSlugs = new Map<string, string>();
  for (const o of orgs ?? []) {
    const row = o as { id: string; slug?: string | null };
    const s = row.slug ? normalize(row.slug) : "";
    if (s) orgSlugs.set(s, row.id);
  }

  // 3) usernames table
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

  // Collisions: slug in both profile set and org set (denormalized)
  const collisions: { slug: string; profileId: string; orgId: string }[] = [];
  for (const [slug, profileInfo] of profileSlugs) {
    const orgId = orgSlugs.get(slug);
    if (orgId) collisions.push({ slug, profileId: profileInfo.id, orgId });
  }

  // usernames: same slug with multiple owner_types or multiple owner_ids
  const usernamesConflicts: { slug: string; owners: { owner_type: string; owner_id: string }[] }[] = [];
  for (const [slug, owners] of usernamesBySlug) {
    const types = new Set(owners.map((o) => o.owner_type));
    const ids = new Set(owners.map((o) => o.owner_id));
    if (types.size > 1 || ids.size > 1) {
      usernamesConflicts.push({ slug, owners });
    }
  }

  // Orgs not in usernames (backfill gap)
  const orgsNotInUsernames: { slug: string; orgId: string }[] = [];
  for (const [slug, orgId] of orgSlugs) {
    const list = usernamesBySlug.get(slug);
    const hasOrg = list?.some((o) => o.owner_type === "org" && o.owner_id === orgId);
    if (!hasOrg) orgsNotInUsernames.push({ slug, orgId });
  }

  console.log("--- Profile slugs (username / twitter_username):", profileSlugs.size);
  console.log("--- Org slugs:", orgSlugs.size);
  console.log("--- usernames rows (unique normalized slugs):", usernamesBySlug.size);
  console.log("");

  if (collisions.length > 0) {
    console.error("[auditNamespaceCollisions] COLLISIONS (same slug in profiles and orgs):");
    for (const c of collisions) {
      console.error("  slug:", c.slug, "| profileId:", c.profileId, "| orgId:", c.orgId);
    }
    console.error("");
  }

  if (usernamesConflicts.length > 0) {
    console.error("[auditNamespaceCollisions] USERNAMES TABLE CONFLICTS (same slug, multiple owners):");
    for (const c of usernamesConflicts) {
      console.error("  slug:", c.slug, "| owners:", JSON.stringify(c.owners));
    }
    console.error("");
  }

  if (orgsNotInUsernames.length > 0) {
    console.log("[auditNamespaceCollisions] Orgs not in usernames (backfill needed):", orgsNotInUsernames.length);
    for (const o of orgsNotInUsernames.slice(0, 20)) {
      console.log("  ", o.slug, o.orgId);
    }
    if (orgsNotInUsernames.length > 20) console.log("  ... and", orgsNotInUsernames.length - 20, "more");
    console.log("");
  }

  const hasProblems = collisions.length > 0 || usernamesConflicts.length > 0;
  if (hasProblems) {
    console.error("Resolve collisions and usernames conflicts before enforcing single global namespace.");
    process.exit(1);
  }

  console.log("[auditNamespaceCollisions] No profile/org collisions found.");
  if (orgsNotInUsernames.length > 0) {
    console.log("[auditNamespaceCollisions] Run backfill so every org.slug has a usernames row, then enforce create_org to use usernames.");
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
