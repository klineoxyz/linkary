/**
 * Server-side discovery service for paid Linkary discovery/search.
 *
 * Contract: returns only explicitly allowlisted, discovery-safe fields.
 * Does NOT use owner/private payloads or raw DB rows in responses.
 * Does NOT expose: email, exact location, pricing, auth ids, private metadata.
 *
 * Use from authenticated API routes only, after entitlement check.
 * /analytics remains the owner of deep analytics; discovery uses only approved snapshot fields.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DiscoveryProfileResult, DiscoveryOrgResult } from "./discoveryAllowlist";

/** Max results per discovery query (profiles or orgs). */
const DEFAULT_DISCOVERY_LIMIT = 50;
const MAX_DISCOVERY_LIMIT = 100;

/**
 * Discovery-safe columns from public_profile_view only.
 * Explicit allowlist; never select id, email, location, meta, or other sensitive columns.
 */
const PUBLIC_PROFILE_VIEW_DISCOVERY_COLUMNS =
  "username, display_name, bio, avatar_url, website, twitter_username, profile_type, followers_total, avg_engagement_rate, xscore";

type ProfileRow = {
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  website: string | null;
  twitter_username: string | null;
  profile_type: string | null;
  followers_total: number | null;
  avg_engagement_rate: number | null;
  xscore: number | null;
};

/**
 * Map a row from public_profile_view (with only allowlisted columns) to DiscoveryProfileResult.
 * Never pass raw rows or owner payloads; this mapper is the discovery contract.
 */
function rowToDiscoveryProfile(row: ProfileRow): DiscoveryProfileResult {
  return {
    type: "profile",
    username: row.username ?? null,
    display_name: row.display_name ?? null,
    avatar_url: row.avatar_url ?? null,
    bio: row.bio ?? null,
    profile_type:
      row.profile_type === "individual" || row.profile_type === "project" || row.profile_type === "company"
        ? row.profile_type
        : null,
    twitter_username: row.twitter_username ?? null,
    xscore: row.xscore ?? null,
    analytics_snapshot:
      row.followers_total != null || row.avg_engagement_rate != null
        ? {
            followers: row.followers_total ?? null,
            engagement_rate: row.avg_engagement_rate ?? null,
          }
        : null,
    tags: [],
  };
}

/**
 * Fetch discovery-safe profile list from public_profile_view.
 * Uses explicit column list; no id, email, location, meta.
 * Call only after auth + entitlement check in the API route.
 */
export async function getDiscoveryProfiles(
  client: SupabaseClient,
  options?: { limit?: number; offset?: number; q?: string }
): Promise<DiscoveryProfileResult[]> {
  const limit = Math.min(options?.limit ?? DEFAULT_DISCOVERY_LIMIT, MAX_DISCOVERY_LIMIT);
  const offset = Math.max(0, options?.offset ?? 0);
  const q = options?.q?.trim().replace(/\*/g, "");

  let query = client
    .from("public_profile_view")
    .select(PUBLIC_PROFILE_VIEW_DISCOVERY_COLUMNS, { count: "exact" })
    .order("username", { ascending: true })
    .range(offset, offset + limit - 1);

  if (q && q.length >= 1) {
    query = query.or(
      `username.ilike.%${q}%,display_name.ilike.%${q}%,twitter_username.ilike.%${q}%,bio.ilike.%${q}%`
    );
  }

  const { data: rows, error } = await query;
  if (error) throw error;
  return (rows ?? []).map((r: ProfileRow) => rowToDiscoveryProfile(r));
}

/**
 * Discovery-safe columns from public_org_view only.
 * Explicit allowlist; never select id or sensitive data. Orgs view has no followers/engagement.
 */
const PUBLIC_ORG_VIEW_DISCOVERY_COLUMNS = "slug, name, tagline, logo_url, twitter_username, xscore";

type OrgRow = {
  slug: string | null;
  name: string | null;
  tagline: string | null;
  logo_url: string | null;
  twitter_username: string | null;
  xscore: number | null;
};

function rowToDiscoveryOrg(row: OrgRow): DiscoveryOrgResult {
  return {
    type: "org",
    slug: row.slug ?? "",
    name: row.name ?? "",
    tagline: row.tagline ?? null,
    logo_url: row.logo_url ?? null,
    twitter_username: row.twitter_username ?? null,
    xscore: row.xscore ?? null,
    analytics_snapshot: null,
    ecosystem_categories: [],
  };
}

/**
 * Fetch discovery-safe org list from public_org_view.
 * Call only after auth + entitlement check.
 */
export async function getDiscoveryOrgs(
  client: SupabaseClient,
  options?: { limit?: number; offset?: number; q?: string }
): Promise<DiscoveryOrgResult[]> {
  const limit = Math.min(options?.limit ?? DEFAULT_DISCOVERY_LIMIT, MAX_DISCOVERY_LIMIT);
  const offset = Math.max(0, options?.offset ?? 0);
  const q = options?.q?.trim().replace(/\*/g, "");

  let query = client
    .from("public_org_view")
    .select(PUBLIC_ORG_VIEW_DISCOVERY_COLUMNS, { count: "exact" })
    .order("slug", { ascending: true })
    .range(offset, offset + limit - 1);

  if (q && q.length >= 1) {
    query = query.or(`slug.ilike.%${q}%,name.ilike.%${q}%,twitter_username.ilike.%${q}%,tagline.ilike.%${q}%`);
  }

  const { data: rows, error } = await query;
  if (error) throw error;
  return (rows ?? []).map((r: OrgRow) => rowToDiscoveryOrg(r));
}
