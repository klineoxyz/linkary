/**
 * P11.5: REP score 0–100 from SocialBase (40%), ProofOfWork (35%), NetworkTrust (25%).
 * Store in profiles.rep_score. Always returns integer 0–100; always writes.
 * When verified_followers is null, SocialBase weights are renormalized (no penalty).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type RepBreakdown = {
  rep: number;
  socialBase: number;
  proofOfWork: number;
  networkTrust: number;
};

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const safeLog = (x: number) => (x <= 0 ? 0 : Math.log1p(Math.max(0, x - 1)));

/** Normalize to 0–100 with log scaling; cap raw at 1000 for scale. */
function logScale100(raw: number, cap: number = 1000): number {
  if (raw <= 0) return 0;
  const capped = Math.min(raw, cap);
  const normalized = (safeLog(capped) / safeLog(cap)) * 100;
  return clamp(normalized, 0, 100);
}

/** Linear scale 0–100 with cap. */
function linearScale100(value: number, max: number): number {
  if (max <= 0) return 0;
  return clamp((value / max) * 100, 0, 100);
}

/** Original SocialBase weights: engagement, verified_ratio, ethos, follower_tier */
const SOCIAL_WEIGHTS = { engagement: 0.3, verified_ratio: 0.25, ethos: 0.25, follower_tier: 0.2 };

/**
 * Compute REP for a profile. Always returns integer 0–100 and always updates profiles.rep_score.
 * If no reviews/collabs/network data, ProofOfWork and NetworkTrust = 0 but SocialBase is still computed.
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

  try {
    const [profileRow, collabRowsRes, reviewsRes, caseStudiesRes, connectionsRes, relationsRes] = await Promise.all([
      supabase.from("profiles").select("followers_total, avg_engagement_rate, ethos_score").eq("id", profileId).maybeSingle(),
      supabase
        .from("collab_requests")
        .select("requester_profile_id, target_profile_id")
        .eq("status", "done")
        .or(`requester_profile_id.eq.${profileId},target_profile_id.eq.${profileId}`),
      supabase.from("collab_reviews").select("rating").eq("target_profile_id", profileId),
      supabase.from("case_studies").select("id", { count: "exact", head: true }).eq("owner_type", "profile").eq("owner_profile_id", profileId).eq("is_public", true),
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

    const profile = profileRow?.data as { followers_total?: number | null; avg_engagement_rate?: number | null; ethos_score?: number | null } | null;
    const followers = Math.max(0, Number(profile?.followers_total ?? 0));
    const avgEngagementRate = Number(profile?.avg_engagement_rate ?? 0);
    const ethos = profile?.ethos_score != null ? Number(profile.ethos_score) : null;
    const verifiedFollowers: number | null = null;

    // Layer 1: SocialBase — dynamic reweight when verified_followers is null
    const engagementRateScore = linearScale100(avgEngagementRate, 0.1);
    const verifiedRatioScore = verifiedFollowers != null && followers > 0
      ? clamp((verifiedFollowers / followers) * 100, 0, 100)
      : null;
    const ethosNorm = ethos != null ? clamp(ethos, 0, 100) : 0;
    const followerTierScore = logScale100(followers, 500000);

    const components: { key: keyof typeof SOCIAL_WEIGHTS; weight: number; value: number }[] = [
      { key: "engagement", weight: SOCIAL_WEIGHTS.engagement, value: engagementRateScore },
      { key: "verified_ratio", weight: SOCIAL_WEIGHTS.verified_ratio, value: verifiedRatioScore ?? 0 },
      { key: "ethos", weight: SOCIAL_WEIGHTS.ethos, value: ethosNorm },
      { key: "follower_tier", weight: SOCIAL_WEIGHTS.follower_tier, value: followerTierScore },
    ];

    const included = verifiedRatioScore !== null
      ? components
      : components.filter((c) => c.key !== "verified_ratio");
    const sumWeight = included.reduce((s, c) => s + c.weight, 0);
    if (sumWeight > 0) {
      socialBase = included.reduce((s, c) => s + (c.weight / sumWeight) * c.value, 0);
    }
    socialBase = clamp(socialBase, 0, 100);

    // Layer 2: ProofOfWork (0 when no data)
    const collabRows = (collabRowsRes?.data ?? []) as Array<{ requester_profile_id: string; target_profile_id: string }>;
    const completedCollabs = collabRows.length;
    const reviewsData = (reviewsRes?.data ?? []) as Array<{ rating: number }>;
    const totalReviews = reviewsData.length;
    const avgRating = totalReviews > 0 ? reviewsData.reduce((s, r) => s + r.rating, 0) / totalReviews : 0;
    const reviewQuality = clamp(avgRating * 20, 0, 100);
    const completedCollabsScore = logScale100(completedCollabs, 200);
    const reviewsVolumeScore = logScale100(totalReviews, 100);
    const caseStudiesCount = (caseStudiesRes as { count?: number })?.count ?? 0;
    const caseStudiesScore = clamp(caseStudiesCount * 10, 0, 100);
    proofOfWork =
      0.4 * reviewQuality + 0.3 * completedCollabsScore + 0.2 * reviewsVolumeScore + 0.1 * caseStudiesScore;
    proofOfWork = clamp(proofOfWork, 0, 100);

    // Layer 3: NetworkTrust (0 when no data)
    const verifiedConnections = (connectionsRes as { count?: number })?.count ?? 0;
    const relations = (relationsRes?.data ?? []) as Array<{ relation_type: string }>;
    const affiliatesCount = relations.filter((r) => r.relation_type === "affiliate").length;
    const ambassadorCount = relations.filter((r) => r.relation_type === "ambassador").length;
    const counterpartyCounts: Record<string, number> = {};
    for (const row of collabRows) {
      const other = row.requester_profile_id === profileId ? row.target_profile_id : row.requester_profile_id;
      counterpartyCounts[other] = (counterpartyCounts[other] ?? 0) + 1;
    }
    const repeatCollabBonus = Object.values(counterpartyCounts).filter((c) => c > 1).length;
    const verifiedConnectionsScore = logScale100(verifiedConnections, 500);
    const affiliatesScore = logScale100(affiliatesCount, 50);
    const ambassadorScore = logScale100(ambassadorCount, 50);
    const repeatCollabScore = logScale100(repeatCollabBonus, 20);
    networkTrust =
      0.5 * verifiedConnectionsScore + 0.2 * affiliatesScore + 0.2 * ambassadorScore + 0.1 * repeatCollabScore;
    networkTrust = clamp(networkTrust, 0, 100);
  } catch {
    /* leave components at 0 */
  }

  const rep = Math.round(0.4 * socialBase + 0.35 * proofOfWork + 0.25 * networkTrust);
  const repClamped = clamp(rep, 0, 100);

  if (write) {
    await supabase.from("profiles").update({ rep_score: repClamped }).eq("id", profileId);
  }

  return { rep: repClamped, socialBase, proofOfWork, networkTrust };
}

/**
 * Call after mutations that affect REP (review created, collab done, case study visibility, relations).
 * Recomputes REP for the given profile(s) and writes profiles.rep_score.
 */
export async function recomputeRepForProfiles(
  profileIds: string[],
  supabase: SupabaseClient
): Promise<void> {
  for (const id of [...new Set(profileIds)]) {
    await computeRep(id, supabase, { write: true });
  }
}
