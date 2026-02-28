/**
 * P11.5: REP score 0–100 from SocialBase (40%), ProofOfWork (35%), NetworkTrust (25%).
 * Store in profiles.rep_score. Always returns integer 0–100; always writes when write !== false.
 *
 * SocialBase: When verified_followers is null, we use engagement + ethos + follower_tier only (no penalty).
 * TODO: When verified_followers data is available, add verified_ratio component; until then reweight over the rest.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type RepBreakdown = {
  rep: number;
  socialBase: number;
  proofOfWork: number;
  networkTrust: number;
  breakdown?: RepBreakdownDetail;
};

export type RepBreakdownDetail = {
  socialBase: {
    followerTierScore: number;
    engagementScore: number;
    ethosScore: number;
    verifiedRatioScore: number | null;
  };
  proofOfWork: {
    reviewQuality: number;
    completedCollabsScore: number;
    reviewsVolumeScore: number;
    caseStudiesScore: number;
  };
  networkTrust: {
    verifiedConnectionsScore: number;
    affiliatesScore: number;
    ambassadorScore: number;
    repeatCollabScore: number;
  };
};

const clamp = (x: number, lo: number, hi: number): number => {
  const n = Number(x);
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
};
const safeLog = (x: number): number => (x <= 0 ? 0 : Math.log1p(Math.max(0, x - 1)));

/** Normalize to 0–100 with log scaling; cap raw at cap. */
function logScale100(raw: number, cap: number = 1000): number {
  const r = Number(raw);
  if (Number.isNaN(r) || r <= 0) return 0;
  const capped = Math.min(r, cap);
  const normalized = (safeLog(capped) / safeLog(cap)) * 100;
  return clamp(normalized, 0, 100);
}

/** Linear scale 0–100 with max. */
function linearScale100(value: number, max: number): number {
  const v = Number(value);
  const m = Number(max);
  if (Number.isNaN(v) || Number.isNaN(m) || m <= 0) return 0;
  return clamp((v / m) * 100, 0, 100);
}

const SOCIAL_WEIGHTS = { engagement: 0.3, verified_ratio: 0.25, ethos: 0.25, follower_tier: 0.2 };

/** Engagement: canonical input is avg_engagement_per_post (raw count). Log scale cap 5000 so strong engagement scores higher without whales dominating. */
const ENGAGEMENT_PER_POST_CAP = 5000;

/**
 * Compute REP for a profile. Returns integer 0–100; optionally writes to profiles.rep_score.
 * If no reviews/collabs/network data, ProofOfWork and NetworkTrust = 0 but SocialBase is still computed.
 * When verified_followers is absent, SocialBase uses engagement + ethos + follower_tier only (no penalty).
 */
export async function computeRep(
  profileId: string,
  supabase: SupabaseClient,
  options: { write?: boolean } = {}
): Promise<RepBreakdown> {
  const write = options.write !== false;

  let socialBase = 0;
  let proofOfWork = 0;
  let networkTrust = 0;
  let detail: RepBreakdownDetail = {
    socialBase: { followerTierScore: 0, engagementScore: 0, ethosScore: 0, verifiedRatioScore: null },
    proofOfWork: { reviewQuality: 0, completedCollabsScore: 0, reviewsVolumeScore: 0, caseStudiesScore: 0 },
    networkTrust: { verifiedConnectionsScore: 0, affiliatesScore: 0, ambassadorScore: 0, repeatCollabScore: 0 },
  };

  try {
    const [profileRow, rollupRow, collabRowsRes, reviewsRes, caseStudiesRes, connectionsRes, relationsRes] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("followers_total, avg_engagement_per_post, ethos_score")
          .eq("id", profileId)
          .maybeSingle(),
        supabase
          .from("x_analytics_rollups")
          .select("engagement_rate_30d")
          .eq("profile_id", profileId)
          .maybeSingle(),
        supabase
          .from("collab_requests")
          .select("requester_profile_id, target_profile_id")
          .eq("status", "done")
          .or(`requester_profile_id.eq.${profileId},target_profile_id.eq.${profileId}`),
        supabase.from("collab_reviews").select("rating").eq("target_profile_id", profileId),
        supabase
          .from("case_studies")
          .select("id", { count: "exact", head: true })
          .eq("owner_type", "profile")
          .eq("owner_profile_id", profileId)
          .eq("is_public", true),
        supabase
          .from("connections")
          .select("id", { count: "exact", head: true })
          .eq("status", "accepted")
          .or(`requester_profile_id.eq.${profileId},recipient_profile_id.eq.${profileId}`),
        supabase
          .from("profile_relations")
          .select("id, relation_type")
          .or(`source_profile_id.eq.${profileId},target_profile_id.eq.${profileId}`)
          .eq("is_public", true),
      ]);

    const profile = profileRow?.data as {
      followers_total?: number | null;
      avg_engagement_per_post?: number | null;
      ethos_score?: number | null;
    } | null;
    const followers = clamp(Number(profile?.followers_total ?? 0) || 0, 0, Number.MAX_SAFE_INTEGER);
    let avgEngagementPerPost: number | null =
      profile?.avg_engagement_per_post != null && Number.isFinite(Number(profile.avg_engagement_per_post))
        ? Number(profile.avg_engagement_per_post)
        : null;
    if (avgEngagementPerPost == null && rollupRow?.data) {
      const rollup = rollupRow.data as { engagement_rate_30d?: number | null };
      const rate30 = Number(rollup?.engagement_rate_30d ?? 0);
      if (Number.isFinite(rate30) && followers > 0) {
        avgEngagementPerPost = (rate30 / 100) * followers;
      }
    }
    const ethos = profile?.ethos_score != null && Number.isFinite(Number(profile.ethos_score))
      ? Number(profile.ethos_score)
      : null;
    const verifiedFollowers: number | null = null;

    // Layer 1: SocialBase — engagement = avg_engagement_per_post (count), log-scaled
    const engagementScore = logScale100(avgEngagementPerPost ?? 0, ENGAGEMENT_PER_POST_CAP);
    const verifiedRatioScore =
      verifiedFollowers != null && followers > 0 ? clamp((verifiedFollowers / followers) * 100, 0, 100) : null;
    const ethosNorm = ethos != null ? clamp(ethos, 0, 100) : 0;
    const followerTierScore = logScale100(followers, 500000);

    detail.socialBase = {
      followerTierScore,
      engagementScore,
      ethosScore: ethosNorm,
      verifiedRatioScore,
    };

    const components: { key: keyof typeof SOCIAL_WEIGHTS; weight: number; value: number }[] = [
      { key: "engagement", weight: SOCIAL_WEIGHTS.engagement, value: engagementScore },
      { key: "verified_ratio", weight: SOCIAL_WEIGHTS.verified_ratio, value: verifiedRatioScore ?? 0 },
      { key: "ethos", weight: SOCIAL_WEIGHTS.ethos, value: ethosNorm },
      { key: "follower_tier", weight: SOCIAL_WEIGHTS.follower_tier, value: followerTierScore },
    ];
    const included =
      verifiedRatioScore !== null ? components : components.filter((c) => c.key !== "verified_ratio");
    const sumWeight = included.reduce((s, c) => s + c.weight, 0);
    if (sumWeight > 0) {
      socialBase = included.reduce((s, c) => s + (c.weight / sumWeight) * c.value, 0);
    }
    socialBase = clamp(socialBase, 0, 100);

    // Layer 2: ProofOfWork
    const collabRows = (collabRowsRes?.data ?? []) as Array<{
      requester_profile_id: string;
      target_profile_id: string;
    }>;
    const completedCollabs = collabRows.length;
    const reviewsData = (reviewsRes?.data ?? []) as Array<{ rating: number }>;
    const totalReviews = reviewsData.length;
    const avgRating =
      totalReviews > 0 ? reviewsData.reduce((s, r) => s + Number(r.rating || 0), 0) / totalReviews : 0;
    const reviewQuality = clamp(avgRating * 20, 0, 100);
    const completedCollabsScore = logScale100(completedCollabs, 200);
    const reviewsVolumeScore = logScale100(totalReviews, 100);
    const caseStudiesCount = (caseStudiesRes as { count?: number })?.count ?? 0;
    const caseStudiesScore = clamp(caseStudiesCount * 10, 0, 100);
    detail.proofOfWork = {
      reviewQuality,
      completedCollabsScore,
      reviewsVolumeScore,
      caseStudiesScore,
    };
    proofOfWork =
      0.4 * reviewQuality +
      0.3 * completedCollabsScore +
      0.2 * reviewsVolumeScore +
      0.1 * caseStudiesScore;
    proofOfWork = clamp(proofOfWork, 0, 100);

    // Layer 3: NetworkTrust
    const verifiedConnections = (connectionsRes as { count?: number })?.count ?? 0;
    const relations = (relationsRes?.data ?? []) as Array<{ relation_type: string }>;
    const affiliatesCount = relations.filter((r) => r.relation_type === "affiliate").length;
    const ambassadorCount = relations.filter((r) => r.relation_type === "ambassador").length;
    const counterpartyCounts: Record<string, number> = {};
    for (const row of collabRows) {
      const other =
        row.requester_profile_id === profileId ? row.target_profile_id : row.requester_profile_id;
      counterpartyCounts[other] = (counterpartyCounts[other] ?? 0) + 1;
    }
    const repeatCollabBonus = Object.values(counterpartyCounts).filter((c) => c > 1).length;
    const verifiedConnectionsScore = logScale100(verifiedConnections, 500);
    const affiliatesScore = logScale100(affiliatesCount, 50);
    const ambassadorScore = logScale100(ambassadorCount, 50);
    const repeatCollabScore = logScale100(repeatCollabBonus, 20);
    detail.networkTrust = {
      verifiedConnectionsScore,
      affiliatesScore,
      ambassadorScore,
      repeatCollabScore,
    };
    networkTrust =
      0.5 * verifiedConnectionsScore +
      0.2 * affiliatesScore +
      0.2 * ambassadorScore +
      0.1 * repeatCollabScore;
    networkTrust = clamp(networkTrust, 0, 100);
  } catch {
    /* leave at 0 */
  }

  const rep = Math.round(0.4 * socialBase + 0.35 * proofOfWork + 0.25 * networkTrust);
  const repClamped = clamp(rep, 0, 100);

  if (write) {
    await supabase.from("profiles").update({ rep_score: repClamped }).eq("id", profileId);
  }

  return {
    rep: repClamped,
    socialBase,
    proofOfWork,
    networkTrust,
    breakdown: detail,
  };
}

/**
 * Call after mutations that affect REP (review created, collab done, case study visibility, relations).
 */
export async function recomputeRepForProfiles(
  profileIds: string[],
  supabase: SupabaseClient
): Promise<void> {
  for (const id of [...new Set(profileIds)]) {
    await computeRep(id, supabase, { write: true });
  }
}
