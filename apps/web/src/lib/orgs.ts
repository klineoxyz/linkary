/**
 * Supabase helpers for orgs, members, affiliations, ambassadors, metrics.
 * Used by figma app (Dashboard, OrgDetail, Profile).
 */
import { supabase } from "./supabase";

export type OrgType = "company" | "brand" | "project" | "agency";

export type Org = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  website: string | null;
  twitter_username: string | null;
  logo_url: string | null;
  org_type: OrgType;
  parent_org_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_crypto_project?: boolean | null;
  has_token?: boolean | null;
  token_symbol?: string | null;
  dexscreener_url?: string | null;
  xscore?: number | null;
  /** Whether this org is publicly listed on Linkary public pages/search. */
  published?: boolean;
  public_layout?: unknown;
  /** Owner user id; used for RLS. */
  owner_profile_id?: string | null;
  /** X verification (required for publish). */
  x_account_username?: string | null;
  x_account_user_id?: string | null;
  x_connected_at?: string | null;
  is_x_verified?: boolean;
}

export type OrgMember = {
  id: string;
  org_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  created_at: string;
};

export type OrgAffiliation = {
  id: string;
  org_id: string;
  profile_id: string;
  status: "invited" | "active" | "removed";
  invited_by: string | null;
  created_at: string;
};

export type OrgAmbassador = {
  id: string;
  org_id: string;
  profile_id: string;
  status: "invited" | "active" | "removed";
  invited_by: string | null;
  created_at: string;
};

export type OrgMetrics = {
  org_id: string;
  combined_followers: number;
  avg_engagement_rate: number;
  potential_reach: number;
  updated_at: string;
};

const ORGS = "orgs";
const ORG_MEMBERS = "org_members";
const ORG_AFFILIATIONS = "org_affiliations";
const ORG_AMBASSADORS = "org_ambassadors";
const ORG_METRICS = "org_metrics";
const PROFILES = "profiles";

/** Sanitize slug for URL: lowercase, replace spaces with -, remove invalid chars. */
export function sanitizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Check if a slug is taken. Returns { available: boolean, suggested?: string } if taken. */
export async function checkSlugAvailable(slug: string): Promise<{ available: boolean; suggested?: string }> {
  const s = sanitizeSlug(slug);
  if (s.length < 2) return { available: false };
  const { data: existing } = await supabase
    .from(ORGS)
    .select("id")
    .ilike("slug", s)
    .maybeSingle();
  if (!existing) return { available: true };
  for (let n = 2; n <= 99; n++) {
    const candidate = s + "-" + n;
    const { data: taken } = await supabase.from(ORGS).select("id").ilike("slug", candidate).maybeSingle();
    if (!taken) return { available: false, suggested: candidate };
  }
  return { available: false, suggested: s + "-" + Date.now().toString(36) };
}

/** Create org via RPC (atomic: org + membership). Org is unverified and unpublished until X is connected. */
export async function createOrg(
  userId: string,
  payload: {
    slug?: string;
    name: string;
    tagline?: string;
    website?: string;
    twitter_username?: string;
    logo_url?: string;
    org_type: OrgType;
    parent_org_id?: string | null;
  }
): Promise<{ data: Org | null; error: string | null }> {
  const slugInput = payload.slug?.trim() ? sanitizeSlug(payload.slug) : "";
  const { data: raw, error } = await supabase.rpc("create_org_and_membership", {
    payload: {
      name: payload.name.trim(),
      org_type: payload.org_type,
      slug: slugInput || undefined,
      tagline: payload.tagline?.trim() || undefined,
      website: payload.website?.trim() || undefined,
      twitter_username: payload.twitter_username?.trim()?.replace(/^@/, "") || undefined,
      logo_url: payload.logo_url?.trim() || undefined,
      parent_org_id: payload.parent_org_id ?? undefined,
    },
  });
  if (error) return { data: null, error: error.message };
  const org = Array.isArray(raw) ? raw[0] : raw;
  return { data: org as Org, error: null };
}

/** Ensure user is owner of org (bootstrap after create). Idempotent. */
export async function ensureOrgOwnerMembership(orgId: string, userId: string): Promise<{ error: string | null }> {
  const { data: existing } = await supabase
    .from(ORG_MEMBERS)
    .select("id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return { error: null };
  const { error } = await supabase.from(ORG_MEMBERS).insert({
    org_id: orgId,
    user_id: userId,
    role: "owner",
  });
  return { error: error?.message ?? null };
}

/** List orgs where the user is a member or owner (owner_profile_id). Ensures owned orgs appear even without org_members row. */
export async function listOrgsForUser(userId: string): Promise<Org[]> {
  const [membersRes, ownedRes] = await Promise.all([
    supabase.from(ORG_MEMBERS).select("org_id").eq("user_id", userId),
    supabase.from(ORGS).select("id").eq("owner_profile_id", userId),
  ]);
  const memberIds = new Set((membersRes.data ?? []).map((m: { org_id: string }) => m.org_id));
  const ownedIds = (ownedRes.data ?? []).map((r: { id: string }) => r.id);
  const ids = [...new Set([...memberIds, ...ownedIds])];
  if (ids.length === 0) return [];
  const { data: orgs, error } = await supabase
    .from(ORGS)
    .select("*")
    .in("id", ids)
    .order("updated_at", { ascending: false });
  if (error) return [];
  return (orgs ?? []) as Org[];
}

/** Alias for listOrgsForUser. */
export const listMyOrgs = listOrgsForUser;

/** Get org by id. */
export async function getOrgById(orgId: string): Promise<Org | null> {
  const { data, error } = await supabase
    .from(ORGS)
    .select("*")
    .eq("id", orgId)
    .maybeSingle();
  if (error) return null;
  return data as Org | null;
}

/** Get org by slug (case-insensitive). */
export async function getOrgBySlug(slug: string): Promise<Org | null> {
  const { data, error } = await supabase
    .from(ORGS)
    .select("*")
    .ilike("slug", slug.trim().toLowerCase())
    .maybeSingle();
  if (error) return null;
  return data as Org | null;
}

/** Update org (caller must be owner/admin via RLS). xscore is write-only via Wallchain/cron/service-role; never accepted here. */
export async function updateOrg(
  orgId: string,
  payload: Partial<Pick<Org, "name" | "slug" | "tagline" | "website" | "twitter_username" | "logo_url" | "is_crypto_project" | "has_token" | "token_symbol" | "dexscreener_url" | "published">>
): Promise<{ error: string | null }> {
  const updates = { ...payload } as Record<string, unknown>;
  if (typeof updates.slug === "string") {
    updates.slug = updates.slug.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }
  delete updates.xscore;
  const { error } = await supabase.from(ORGS).update(updates).eq("id", orgId);
  return { error: error?.message ?? null };
}

/** List members of an org. */
export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await supabase
    .from(ORG_MEMBERS)
    .select("*")
    .eq("org_id", orgId)
    .order("role");
  if (error) return [];
  return (data ?? []) as OrgMember[];
}

/** Invite affiliate by profile id. Insert org_affiliations status=invited. */
export async function inviteAffiliate(
  orgId: string,
  profileId: string,
  invitedByUserId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from(ORG_AFFILIATIONS).insert({
    org_id: orgId,
    profile_id: profileId,
    status: "invited",
    invited_by: invitedByUserId,
  });
  return { error: error?.message ?? null };
}

/** Invite affiliate by handle (lookup profile by username). */
export async function inviteAffiliateByHandle(
  orgId: string,
  invitedByUserId: string,
  profileHandle: string
): Promise<{ error: string | null }> {
  const { data: profile } = await supabase
    .from(PROFILES)
    .select("id")
    .ilike("username", profileHandle.replace(/^@/, "").trim().toLowerCase())
    .maybeSingle();
  if (!profile) return { error: "Profile not found for that handle" };
  return inviteAffiliate(orgId, (profile as { id: string }).id, invitedByUserId);
}

/** Set affiliation status (invited | active | removed). */
export async function setAffiliateStatus(
  affiliationId: string,
  status: "invited" | "active" | "removed"
): Promise<{ error: string | null }> {
  const { error } = await supabase.from(ORG_AFFILIATIONS).update({ status }).eq("id", affiliationId);
  return { error: error?.message ?? null };
}

/** Invite ambassador by profile id. */
export async function inviteAmbassador(
  orgId: string,
  profileId: string,
  invitedByUserId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.from(ORG_AMBASSADORS).insert({
    org_id: orgId,
    profile_id: profileId,
    status: "invited",
    invited_by: invitedByUserId,
  });
  return { error: error?.message ?? null };
}

/** Invite ambassador by handle (lookup profile by username). */
export async function inviteAmbassadorByHandle(
  orgId: string,
  invitedByUserId: string,
  profileHandle: string
): Promise<{ error: string | null }> {
  const { data: profile } = await supabase
    .from(PROFILES)
    .select("id")
    .ilike("username", profileHandle.replace(/^@/, "").trim().toLowerCase())
    .maybeSingle();
  if (!profile) return { error: "Profile not found for that handle" };
  return inviteAmbassador(orgId, (profile as { id: string }).id, invitedByUserId);
}

/** Set ambassador status (invited | active | removed). */
export async function setAmbassadorStatus(
  ambassadorId: string,
  status: "invited" | "active" | "removed"
): Promise<{ error: string | null }> {
  const { error } = await supabase.from(ORG_AMBASSADORS).update({ status }).eq("id", ambassadorId);
  return { error: error?.message ?? null };
}

/** List affiliations for an org (optionally by status). */
export async function listOrgAffiliations(
  orgId: string,
  status?: "invited" | "active" | "removed"
): Promise<OrgAffiliation[]> {
  let q = supabase.from(ORG_AFFILIATIONS).select("*").eq("org_id", orgId);
  if (status) q = q.eq("status", status);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as OrgAffiliation[];
}

/** List ambassadors for an org. */
export async function listOrgAmbassadors(
  orgId: string,
  status?: "invited" | "active" | "removed"
): Promise<OrgAmbassador[]> {
  let q = supabase.from(ORG_AMBASSADORS).select("*").eq("org_id", orgId);
  if (status) q = q.eq("status", status);
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as OrgAmbassador[];
}

/** Accept affiliation (profile owner sets status=active). */
export async function acceptAffiliation(
  affiliationId: string,
  profileId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(ORG_AFFILIATIONS)
    .update({ status: "active" })
    .eq("id", affiliationId)
    .eq("profile_id", profileId);
  return { error: error?.message ?? null };
}

/** Accept ambassador (profile owner sets status=active). */
export async function acceptAmbassador(
  ambassadorId: string,
  profileId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(ORG_AMBASSADORS)
    .update({ status: "active" })
    .eq("id", ambassadorId)
    .eq("profile_id", profileId);
  return { error: error?.message ?? null };
}

/** List affiliations for a profile (invited/active). */
export async function listAffiliationsForProfile(profileId: string): Promise<OrgAffiliation[]> {
  const { data, error } = await supabase
    .from(ORG_AFFILIATIONS)
    .select("*")
    .eq("profile_id", profileId)
    .in("status", ["invited", "active"])
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as OrgAffiliation[];
}

/** List ambassador invites/active for a profile. */
export async function listAmbassadorsForProfile(profileId: string): Promise<OrgAmbassador[]> {
  const { data, error } = await supabase
    .from(ORG_AMBASSADORS)
    .select("*")
    .eq("profile_id", profileId)
    .in("status", ["invited", "active"])
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as OrgAmbassador[];
}

/** Get org_metrics for an org. */
export async function getOrgMetrics(orgId: string): Promise<OrgMetrics | null> {
  const { data, error } = await supabase
    .from(ORG_METRICS)
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) return null;
  return data as OrgMetrics | null;
}

/** Recompute org_metrics via DB RPC (company includes subsidiaries). */
export async function recomputeOrgMetrics(orgId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("recompute_org_metrics", { p_org_id: orgId });
  return { error: error?.message ?? null };
}

/** @deprecated Use recomputeOrgMetrics */
export const recomputeOrgMetricsRpc = recomputeOrgMetrics;

/** Client-side fallback recompute (when RPC not available). */
export async function recomputeOrgMetricsClient(orgId: string): Promise<{ error: string | null }> {
  const [affiliations, ambassadors] = await Promise.all([
    listOrgAffiliations(orgId, "active"),
    listOrgAmbassadors(orgId, "active"),
  ]);
  const profileIds = [...affiliations.map((a) => a.profile_id), ...ambassadors.map((a) => a.profile_id)];
  const uniqueIds = [...new Set(profileIds)];
  if (uniqueIds.length === 0) {
    const { error } = await supabase.from(ORG_METRICS).upsert(
      { org_id: orgId, combined_followers: 0, avg_engagement_rate: 0, potential_reach: 0, updated_at: new Date().toISOString() },
      { onConflict: "org_id" }
    );
    return { error: error?.message ?? null };
  }
  const { data: profiles, error: profError } = await supabase
    .from(PROFILES)
    .select("id, followers_total, avg_engagement_rate")
    .in("id", uniqueIds);
  if (profError) return { error: profError.message };
  const rows = (profiles ?? []) as { followers_total: number; avg_engagement_rate: number }[];
  const totalFollowers = rows.reduce((s, p) => s + Number(p.followers_total ?? 0), 0);
  const weightedEng =
    totalFollowers > 0
      ? rows.reduce((s, p) => s + Number(p.followers_total ?? 0) * Number(p.avg_engagement_rate ?? 0), 0) / totalFollowers
      : 0;
  const { error: upsertError } = await supabase.from(ORG_METRICS).upsert(
    {
      org_id: orgId,
      combined_followers: totalFollowers,
      avg_engagement_rate: weightedEng,
      potential_reach: Math.round(totalFollowers * (Number(weightedEng) || 0)),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" }
  );
  return { error: upsertError?.message ?? null };
}

/** Check if user is owner or admin of org (orgs.owner_profile_id or org_members role owner/admin). */
export async function isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
  const org = await getOrgById(orgId);
  if (org?.owner_profile_id && org.owner_profile_id === userId) return true;
  const { data } = await supabase
    .from(ORG_MEMBERS)
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  return !!data;
}
