/**
 * Public one-pager data: fetch by username (profile or org slug).
 * Uses anon client; RLS and public views expose only safe fields.
 */
import { supabase } from "./supabase";
import { computeLinkaryPower, computeLinkaryInfluence } from "./linkaryScore";

export type PublicLayoutConfig = {
  order?: string[];
  hidden?: string[];
};

export type PublicProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  website: string | null;
  twitter_username: string | null;
  location: string | null;
  published: boolean;
  followers_total: number;
  avg_engagement_rate: number;
  xscore: number | null;
  public_layout?: PublicLayoutConfig | null;
  created_at: string;
  updated_at: string;
};

export type PublicOrg = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  website: string | null;
  twitter_username: string | null;
  logo_url: string | null;
  org_type: string;
  parent_org_id: string | null;
  is_crypto_project: boolean | null;
  has_token: boolean | null;
  token_symbol: string | null;
  dexscreener_url: string | null;
  xscore: number | null;
  public_layout?: PublicLayoutConfig | null;
  created_at: string;
  updated_at: string;
};

export type ProfileSocials = {
  x_url: string | null;
  linkedin_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
  telegram_url: string | null;
};

export type HeaderMedia = {
  header_media_type: "NONE" | "IMAGE" | "VIDEO";
  header_media_url: string | null;
};

export type AnalyticsSnapshot = {
  followers: number | null;
  reach_avg: number | null;
  engagement_rate: number | null;
  likes_avg: number | null;
  replies_avg: number | null;
  spaces_count: number | null;
  followers_delta: number | null;
};

export type PublicEntity = {
  type: "profile" | "org";
  profile?: PublicProfile;
  org?: PublicOrg;
  publicLayout?: PublicLayoutConfig | null;
  socials?: ProfileSocials | null;
  headerMedia?: HeaderMedia | null;
  analyticsSnapshot?: AnalyticsSnapshot | null;
  ethosScore?: number | null;
  ethosResults?: Record<string, unknown> | null;
  linkaryPower?: number;
  linkaryInfluence?: number;
  tier: "free" | "pro";
  caseStudies: Array<{ id: string; title?: string | null; description?: string | null; proof_url?: string | null; metrics?: Record<string, unknown>; created_at: string }>;
  reviews: Array<{ id: string; rating: number; body?: string | null; title?: string | null; created_at: string }>;
  affiliate?: { org_id: string; org_name: string; logo_url: string | null; since_date: string | null } | null;
  ambassadors: Array<{ org_id: string; org_name: string; logo_url: string | null; since_date: string | null }>;
  ecosystemCategories: string[];
  subsidiaries: Array<PublicOrg>;
  dexscreenerUrl?: string | null;
  tokenSymbol?: string | null;
};

async function getSubscriptionTier(ownerType: "profile" | "org", ownerId: string): Promise<"free" | "pro"> {
  const { data } = await supabase
    .from("subscriptions")
    .select("tier, status, current_period_end")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (!data || (data as { status?: string }).status !== "active") return "free";
  const end = (data as { current_period_end?: string }).current_period_end;
  if (end && new Date(end) < new Date()) return "free";
  const tier = (data as { tier?: string }).tier;
  return tier === "pro" || tier === "host" || tier === "brand" || tier === "venture" ? "pro" : "free";
}

/** Resolve username to profile or org. Tries profile by username, then by twitter_username, then org by slug. */
export async function getPublicEntityByUsername(username: string): Promise<PublicEntity | null> {
  const norm = username.trim().toLowerCase().replace(/^@/, "");
  if (!norm) return null;

  const [profileByUsername, profileByTwitter, orgRes] = await Promise.all([
    supabase.from("public_profile_view").select("*").ilike("username", norm).maybeSingle(),
    supabase.from("public_profile_view").select("*").ilike("twitter_username", norm).maybeSingle(),
    supabase.from("public_org_view").select("*").ilike("slug", norm).maybeSingle(),
  ]);

  const profile = (profileByUsername.data ?? profileByTwitter.data) as PublicProfile | null;
  const org = orgRes.data as PublicOrg | null;

  if (profile) return buildPublicProfileEntity(profile, norm);
  if (org) return buildPublicOrgEntity(org, norm);
  return null;
}

async function buildPublicProfileEntity(profile: PublicProfile, _norm: string): Promise<PublicEntity> {
  const tier = await getSubscriptionTier("profile", profile.id);
  const [socialsRow, mediaRow, snapshotRow, window30Row, caseRows, reviewRows, affRow, ambRows] = await Promise.all([
    supabase.from("profile_socials").select("*").eq("profile_id", profile.id).maybeSingle(),
    supabase.from("profile_media").select("header_media_type, header_media_url").eq("profile_id", profile.id).maybeSingle(),
    supabase.from("analytics_snapshots").select("*").eq("owner_type", "profile").eq("owner_id", profile.id).eq("platform", "x").eq("window_days", 30).maybeSingle(),
    supabase.from("x_window_aggregates").select("*").eq("owner_type", "profile").eq("owner_id", profile.id).eq("window_days", 30).order("as_of", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("case_studies").select("id, title, description, proof_url, metrics, created_at").eq("owner_type", "profile").eq("owner_profile_id", profile.id).order("created_at", { ascending: false }).limit(tier === "pro" ? 100 : 2),
    supabase.from("reviews").select("id, rating, body, title, created_at").eq("reviewee_type", "profile").eq("reviewee_profile_id", profile.id).eq("verified_deal", true).order("created_at", { ascending: false }).limit(tier === "pro" ? 100 : 2),
    supabase.from("org_affiliations").select("org_id").eq("profile_id", profile.id).eq("status", "active").maybeSingle(),
    supabase.from("org_ambassadors").select("org_id").eq("profile_id", profile.id).eq("status", "active").limit(10),
  ]);

  const caseStudies = (caseRows.data ?? []) as PublicEntity["caseStudies"];
  const reviews = (reviewRows.data ?? []) as PublicEntity["reviews"];
  let affiliate: PublicEntity["affiliate"] = null;
  if (affRow.data?.org_id) {
    const o = await supabase.from("orgs").select("id, name, logo_url").eq("id", (affRow.data as { org_id: string }).org_id).maybeSingle();
    if (o.data) {
      const d = o.data as { id: string; name: string; logo_url: string | null };
      const link = await supabase.from("org_affiliations").select("created_at").eq("profile_id", profile.id).eq("org_id", d.id).maybeSingle();
      affiliate = { org_id: d.id, org_name: d.name, logo_url: d.logo_url, since_date: link.data?.created_at?.slice(0, 10) ?? null };
    }
  }
  const ambassadorOrgIds = (ambRows.data ?? []).map((r: { org_id: string }) => r.org_id);
  const ambassadors: PublicEntity["ambassadors"] = [];
  for (const orgId of ambassadorOrgIds) {
    const o = await supabase.from("orgs").select("id, name, logo_url").eq("id", orgId).maybeSingle();
    if (o.data) {
      const d = o.data as { id: string; name: string; logo_url: string | null };
      const link = await supabase.from("org_ambassadors").select("created_at").eq("profile_id", profile.id).eq("org_id", d.id).maybeSingle();
      ambassadors.push({ org_id: d.id, org_name: d.name, logo_url: d.logo_url, since_date: link.data?.created_at?.slice(0, 10) ?? null });
    }
  }

  let ethosScore: number | null = null;
  let ethosResults: Record<string, unknown> | null = null;
  if (profile.twitter_username) {
    const userkey = `service:x.com:username:${profile.twitter_username}`;
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const res = await fetch(`${base}/api/ethos/score?userkey=${encodeURIComponent(userkey)}`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const j = await res.json();
      ethosScore = j.score_value ?? null;
      ethosResults = typeof j.score_json === "object" && j.score_json ? (j.score_json as Record<string, unknown>) : null;
    }
  }

  const ratingAvg = reviews.length > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : undefined;
  const { score1000: linkaryPower } = await import("./linkaryScore").then((m) =>
    m.computeLinkaryPower({
      ethosScore: ethosScore ?? profile.xscore ?? undefined,
      xscore: profile.xscore ?? undefined,
      followers: profile.followers_total,
      engagementRate: profile.avg_engagement_rate,
      verifiedReviewsCount: reviews.length,
      ratingAvg,
    })
  );

  const legacySnapshot = snapshotRow.data as AnalyticsSnapshot | null;
  const win30 = window30Row.data as { followers_end?: number; followers_delta?: number; avg_engagement_rate?: number; avg_likes_per_post?: number; avg_replies_per_post?: number; reach_avg?: number; spaces_count?: number } | null;
  const analyticsSnapshot: PublicEntity["analyticsSnapshot"] = win30
    ? {
        followers: win30.followers_end ?? null,
        reach_avg: win30.reach_avg ?? null,
        engagement_rate: win30.avg_engagement_rate ?? null,
        likes_avg: win30.avg_likes_per_post ?? null,
        replies_avg: win30.avg_replies_per_post ?? null,
        spaces_count: win30.spaces_count ?? null,
        followers_delta: win30.followers_delta ?? null,
      }
    : legacySnapshot
      ? {
          followers: legacySnapshot.followers ?? null,
          reach_avg: legacySnapshot.reach_avg ?? null,
          engagement_rate: legacySnapshot.engagement_rate ?? null,
          likes_avg: legacySnapshot.likes_avg ?? null,
          replies_avg: legacySnapshot.replies_avg ?? null,
          spaces_count: legacySnapshot.spaces_count ?? null,
          followers_delta: legacySnapshot.followers_delta ?? null,
        }
      : null;
  return {
    type: "profile",
    profile,
    publicLayout: profile.public_layout ?? null,
    socials: socialsRow.data ? (socialsRow.data as ProfileSocials) : null,
    headerMedia: mediaRow.data ? (mediaRow.data as HeaderMedia) : null,
    analyticsSnapshot,
    ethosScore: ethosScore ?? null,
    ethosResults,
    linkaryPower,
    tier,
    caseStudies,
    reviews,
    affiliate,
    ambassadors,
    ecosystemCategories: [],
    subsidiaries: [],
  };
}

async function buildPublicOrgEntity(org: PublicOrg, _norm: string): Promise<PublicEntity> {
  const tier = await getSubscriptionTier("org", org.id);
  const [mediaRow, snapshotRow, ecosystemRows, subsRows, caseRows, reviewRows, ambRows, affRows] = await Promise.all([
    supabase.from("org_media").select("header_media_type, header_media_url").eq("org_id", org.id).maybeSingle(),
    supabase.from("analytics_snapshots").select("*").eq("owner_type", "org").eq("owner_id", org.id).eq("platform", "x").eq("window_days", 30).maybeSingle(),
    supabase.from("org_ecosystem_categories").select("category").eq("org_id", org.id),
    supabase.from("org_relationships").select("child_org_id").eq("parent_org_id", org.id).eq("rel_type", "SUBSIDIARY"),
    supabase.from("case_studies").select("id, title, description, proof_url, metrics, created_at").eq("owner_type", "org").eq("owner_org_id", org.id).order("created_at", { ascending: false }).limit(tier === "pro" ? 100 : 2),
    supabase.from("reviews").select("id, rating, body, title, created_at").eq("reviewee_type", "org").eq("reviewee_org_id", org.id).eq("verified_deal", true).order("created_at", { ascending: false }).limit(tier === "pro" ? 100 : 2),
    supabase.from("org_ambassadors").select("profile_id").eq("org_id", org.id).eq("status", "active"),
    supabase.from("org_affiliations").select("profile_id").eq("org_id", org.id).eq("status", "active"),
  ]);

  const ecosystemCategories = (ecosystemRows.data ?? []).map((r: { category: string }) => r.category);
  const subsidiaryIds = (subsRows.data ?? []).map((r: { child_org_id: string }) => r.child_org_id);
  const subsidiaries: PublicOrg[] = [];
  for (const id of subsidiaryIds) {
    const o = await supabase.from("public_org_view").select("*").eq("id", id).maybeSingle();
    if (o.data) subsidiaries.push(o.data as PublicOrg);
  }

  const caseStudies = (caseRows.data ?? []) as PublicEntity["caseStudies"];
  const reviews = (reviewRows.data ?? []) as PublicEntity["reviews"];

  const { score1000: linkaryInfluence } = computeLinkaryInfluence({
    ethosScore: org.xscore ?? undefined,
    xscore: org.xscore ?? undefined,
    verifiedReviewsCount: reviews.length,
    activeAmbassadorsCount: (ambRows.data ?? []).length,
    activeAffiliatesCount: (affRows.data ?? []).length,
  });

  const snapshot = snapshotRow.data as AnalyticsSnapshot | null;
  return {
    type: "org",
    org,
    publicLayout: org.public_layout ?? null,
    headerMedia: mediaRow.data ? (mediaRow.data as HeaderMedia) : null,
    analyticsSnapshot: snapshot
      ? {
          followers: snapshot.followers ?? null,
          reach_avg: snapshot.reach_avg ?? null,
          engagement_rate: snapshot.engagement_rate ?? null,
          likes_avg: snapshot.likes_avg ?? null,
          replies_avg: snapshot.replies_avg ?? null,
          spaces_count: snapshot.spaces_count ?? null,
          followers_delta: snapshot.followers_delta ?? null,
        }
      : null,
    linkaryInfluence,
    tier,
    caseStudies,
    reviews,
    ambassadors: [],
    ecosystemCategories,
    subsidiaries,
    dexscreenerUrl: org.dexscreener_url ?? null,
    tokenSymbol: org.token_symbol ?? null,
  };
}
