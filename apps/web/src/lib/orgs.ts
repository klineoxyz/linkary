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
};

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

/** Create org and add current user as owner. Returns org or error. */
export async function createOrg(
  userId: string,
  payload: {
    slug: string;
    name: string;
    tagline?: string;
    website?: string;
    twitter_username?: string;
    logo_url?: string;
    org_type: OrgType;
    parent_org_id?: string | null;
  }
): Promise<{ data: Org | null; error: string | null }> {
  const slugLower = payload.slug.trim().toLowerCase();
  const { data: org, error: orgError } = await supabase
    .from(ORGS)
    .insert({
      slug: slugLower,
      name: payload.name.trim(),
      tagline: payload.tagline?.trim() || null,
      website: payload.website?.trim() || null,
      twitter_username: payload.twitter_username?.trim() || null,
      logo_url: payload.logo_url?.trim() || null,
      org_type: payload.org_type,
      parent_org_id: payload.parent_org_id ?? null,
      created_by: userId,
    })
    .select()
    .single();

  if (orgError) return { data: null, error: orgError.message };
  if (!org) return { data: null, error: "Failed to create org" };

  const { error: memberError } = await supabase.from(ORG_MEMBERS).insert({
    org_id: (org as Org).id,
    user_id: userId,
    role: "owner",
  });

  if (memberError) return { data: null, error: memberError.message };
  return { data: org as Org, error: null };
}

/** List orgs where the user is a member. */
export async function listOrgsForUser(userId: string): Promise<Org[]> {
  const { data: members, error: me } = await supabase
    .from(ORG_MEMBERS)
    .select("org_id")
    .eq("user_id", userId);
  if (me || !members?.length) return [];

  const ids = members.map((m) => m.org_id);
  const { data: orgs, error } = await supabase
    .from(ORGS)
    .select("*")
    .in("id", ids)
    .order("updated_at", { ascending: false });
  if (error) return [];
  return (orgs ?? []) as Org[];
}

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

/** Update org (caller must be owner/admin via RLS). */
export async function updateOrg(
  orgId: string,
  payload: Partial<Pick<Org, "name" | "tagline" | "website" | "twitter_username" | "logo_url">>
): Promise<{ error: string | null }> {
  const { error } = await supabase.from(ORGS).update(payload).eq("id", orgId);
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

/** Invite affiliate: insert org_affiliations with status=invited. Profile lookup by username. */
export async function inviteAffiliate(
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

  const { error } = await supabase.from(ORG_AFFILIATIONS).insert({
    org_id: orgId,
    profile_id: (profile as { id: string }).id,
    status: "invited",
    invited_by: invitedByUserId,
  });
  return { error: error?.message ?? null };
}

/** Invite ambassador: insert org_ambassadors with status=invited. */
export async function inviteAmbassador(
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

  const { error } = await supabase.from(ORG_AMBASSADORS).insert({
    org_id: orgId,
    profile_id: (profile as { id: string }).id,
    status: "invited",
    invited_by: invitedByUserId,
  });
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

/** Call DB function to recompute org_metrics (company includes subsidiaries). Use this when migration 20260218100000 is applied. */
export async function recomputeOrgMetricsRpc(orgId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("recompute_org_metrics", { p_org_id: orgId });
  return { error: error?.message ?? null };
}

/** Recompute org_metrics from affiliates + ambassadors (followers_total, avg_engagement_rate). Client-side fallback when RPC is not available. */
export async function recomputeOrgMetrics(orgId: string): Promise<{ error: string | null }> {
  const [affiliations, ambassadors] = await Promise.all([
    listOrgAffiliations(orgId, "active"),
    listOrgAmbassadors(orgId, "active"),
  ]);
  const profileIds = [
    ...affiliations.map((a) => a.profile_id),
    ...ambassadors.map((a) => a.profile_id),
  ];
  const uniqueIds = [...new Set(profileIds)];
  if (uniqueIds.length === 0) {
    const { error } = await supabase.from(ORG_METRICS).upsert(
      {
        org_id: orgId,
        combined_followers: 0,
        avg_engagement_rate: 0,
        potential_reach: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id" }
    );
    return { error: error?.message ?? null };
  }

  const { data: profiles, error: profError } = await supabase
    .from(PROFILES)
    .select("id, followers_total, avg_engagement_rate")
    .in("id", uniqueIds);
  if (profError) return { error: profError.message };

  const rows = (profiles ?? []) as { id: string; followers_total: number; avg_engagement_rate: number }[];
  const totalFollowers = rows.reduce((s, p) => s + Number(p.followers_total ?? 0), 0);
  const weightedEng =
    totalFollowers > 0
      ? rows.reduce((s, p) => s + Number(p.followers_total ?? 0) * Number(p.avg_engagement_rate ?? 0), 0) / totalFollowers
      : 0;
  const potentialReach = Math.round(totalFollowers * (Number(weightedEng) || 0));

  const { error: upsertError } = await supabase.from(ORG_METRICS).upsert(
    {
      org_id: orgId,
      combined_followers: totalFollowers,
      avg_engagement_rate: weightedEng,
      potential_reach: potentialReach,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id" }
  );
  return { error: upsertError?.message ?? null };
}

/** Check if user is owner or admin of org. */
export async function isOrgAdmin(userId: string, orgId: string): Promise<boolean> {
  const { data } = await supabase
    .from(ORG_MEMBERS)
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .in("role", ["owner", "admin"])
    .maybeSingle();
  return !!data;
}
