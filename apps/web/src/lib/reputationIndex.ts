/**
 * Linkary reputation v1: 0–1000 index from marketplace activity + optional social.
 * Used on public profile. Safe when tables or counts fail (returns 0 for missing inputs).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ReputationInputs = {
  completedDealsCount: number;
  verifiedReviewsCount: number;
  ratingAvg: number | null;
  xscore: number | null;
  followers_total: number | null;
  avg_engagement_rate: number | null;
};

export type ComputeReputationOptions = {
  debug?: boolean;
};

const BASE = 50;
const DEALS_COEF = 25;
const DEALS_CAP = 300;
const REVIEWS_COEF = 20;
const REVIEWS_CAP = 300;
const RATING_COEF = 60;
const RATING_CAP = 120;
const SOCIAL_CAP = 200;
const MIN_SCORE = 0;
const MAX_SCORE = 1000;

/**
 * Compute reputation index (0–1000) for a profile.
 * Formula: base 50 + deals*25 (cap 300) + reviews*20 (cap 300) + (ratingAvg-3)*60 (cap ±120) + social (cap 200), clamped 0–1000.
 */
export async function computeReputationIndex(
  profileId: string,
  supabase: SupabaseClient,
  options: ComputeReputationOptions = {}
): Promise<number> {
  const { debug = false } = options;
  const inputs: ReputationInputs = {
    completedDealsCount: 0,
    verifiedReviewsCount: 0,
    ratingAvg: null,
    xscore: null,
    followers_total: null,
    avg_engagement_rate: null,
  };

  try {
    const [dealsSettled, reviewsSettled, profileSettled] = await Promise.allSettled([
      supabase
        .from("gig_deals")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed")
        .or(`owner_profile_id.eq.${profileId},participant_profile_id.eq.${profileId}`),
      supabase
        .from("reviews")
        .select("rating")
        .eq("reviewee_type", "profile")
        .eq("reviewee_profile_id", profileId)
        .eq("verified_deal", true),
      supabase
        .from("profiles")
        .select("xscore, followers_total, avg_engagement_rate")
        .eq("id", profileId)
        .maybeSingle(),
    ]);

    const dealsRes = dealsSettled.status === "fulfilled" ? dealsSettled.value : null;
    const reviewsRes = reviewsSettled.status === "fulfilled" ? reviewsSettled.value : null;
    const profileRes = profileSettled.status === "fulfilled" ? profileSettled.value : null;

    if (dealsRes?.count != null && !dealsRes.error) inputs.completedDealsCount = dealsRes.count;
    if (reviewsRes?.data && !reviewsRes.error && reviewsRes.data.length > 0) {
      const ratings = (reviewsRes.data as Array<{ rating: number }>).map((r) => r.rating);
      inputs.verifiedReviewsCount = ratings.length;
      inputs.ratingAvg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    }
    if (profileRes?.data && !profileRes.error) {
      const p = profileRes.data as { xscore?: number | null; followers_total?: number | null; avg_engagement_rate?: number | null };
      inputs.xscore = p.xscore ?? null;
      inputs.followers_total = p.followers_total ?? null;
      inputs.avg_engagement_rate = p.avg_engagement_rate ?? null;
    }
  } catch {
    /* leave inputs at defaults */
  }

  /* compute score */

  const dealsBonus = Math.min(inputs.completedDealsCount * DEALS_COEF, DEALS_CAP);
  const reviewsBonus = Math.min(inputs.verifiedReviewsCount * REVIEWS_COEF, REVIEWS_CAP);
  const ratingBonus = inputs.ratingAvg != null
    ? Math.max(-RATING_CAP, Math.min(RATING_CAP, (inputs.ratingAvg - 3) * RATING_COEF))
    : 0;
  const socialBonus = inputs.xscore != null && Number.isFinite(inputs.xscore)
    ? Math.min(SOCIAL_CAP, (inputs.xscore as number) / 5)
    : 0;

  const raw = BASE + dealsBonus + reviewsBonus + ratingBonus + socialBonus;
  const score = Math.max(MIN_SCORE, Math.min(MAX_SCORE, Math.round(raw)));

  if (debug) {
    console.log("[reputation v1]", {
      profileId,
      inputs: {
        completedDealsCount: inputs.completedDealsCount,
        verifiedReviewsCount: inputs.verifiedReviewsCount,
        ratingAvg: inputs.ratingAvg,
        xscore: inputs.xscore,
      },
      components: { dealsBonus, reviewsBonus, ratingBonus, socialBonus },
      raw,
      score,
    });
  }

  return score;
}

