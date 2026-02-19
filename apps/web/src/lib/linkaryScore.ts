/**
 * Linkary Power (individual) and Linkary Influence (project/org) formulas.
 * Scores normalized to 0-100 and 0-1000. No breakdown shown publicly yet.
 */

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function scaleTo100(x: number): number {
  return clamp01(x) * 100;
}

function scaleTo1000(x: number): number {
  return Math.round(clamp01(x) * 1000);
}

/** log10(followers+10) / log10(10M+10) -> 0..1 */
function followerAuthority(followers: number | undefined | null): number {
  if (followers == null || !Number.isFinite(followers)) return 0;
  const n = Math.max(0, followers);
  return clamp01(Math.log10(n + 10) / Math.log10(10_000_000 + 10));
}

/** Engagement: rate + replies ratio. Missing -> default 50 (0.5). */
function engagementScore(engagementRate?: number | null, _repliesRatio?: number | null): number {
  if (engagementRate != null && Number.isFinite(engagementRate)) {
    const rate = typeof engagementRate === "number" ? engagementRate : Number(engagementRate);
    return scaleTo100(rate > 1 ? rate / 100 : rate);
  }
  return 50;
}

/** Reviews: rating 0-5 -> 0-100, times verified count factor, cap 100 */
function reviewsScore(ratingAvg?: number | null, verifiedCount?: number): number {
  const r = ratingAvg != null && Number.isFinite(ratingAvg) ? clamp01(ratingAvg / 5) * 100 : 0;
  const count = Math.max(0, verifiedCount ?? 0);
  const factor = Math.min(count / 5, 2);
  return Math.min(100, r * (0.5 + factor * 0.5));
}

/** Verified gigs: min(verified_gigs_count * 10, 100) */
function verifiedGigsScore(verifiedGigsCount?: number): number {
  const n = Math.max(0, verifiedGigsCount ?? 0);
  return Math.min(100, n * 10);
}

/** Case impact: average delta improvements -> 0-100, cap */
function caseImpactScore(deltas?: number[] | null): number {
  if (!deltas?.length) return 0;
  const sum = deltas.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  const avg = sum / deltas.length;
  return scaleTo100(avg > 1 ? avg / 100 : avg);
}

export type LinkaryPowerInput = {
  ethosScore?: number | null;
  xscore?: number | null;
  followers?: number | null;
  engagementRate?: number | null;
  verifiedReviewsCount?: number;
  verifiedGigsCount?: number;
  caseStudyDeltas?: number[] | null;
  ratingAvg?: number | null;
};

/**
 * Individual Linkary Power (0-1000).
 * Base 0-100: 20% Ethos, 20% XScore, 15% Review, 15% Engagement, 10% FollowerAuthority,
 * 10% VerifiedGigs, 10% CaseImpact. Then x10.
 */
export function computeLinkaryPower(input: LinkaryPowerInput): {
  score100: number;
  score1000: number;
  breakdown: Record<string, number>;
} {
  const ethosNorm = scaleTo100((input.ethosScore ?? 0) / 100);
  const xscoreNorm = scaleTo100((input.xscore ?? 0) / 10);
  const review = reviewsScore(input.ratingAvg, input.verifiedReviewsCount ?? 0);
  const engagement = engagementScore(input.engagementRate);
  const followerAuth = scaleTo100(followerAuthority(input.followers));
  const verifiedGigs = verifiedGigsScore(input.verifiedGigsCount);
  const caseImpact = caseImpactScore(input.caseStudyDeltas);

  const score100 =
    ethosNorm * 0.2 +
    xscoreNorm * 0.2 +
    review * 0.15 +
    engagement * 0.15 +
    followerAuth * 0.1 +
    verifiedGigs * 0.1 +
    caseImpact * 0.1;
  const score1000 = Math.min(1000, Math.round(score100 * 10));

  return {
    score100: Math.round(score100 * 100) / 100,
    score1000,
    breakdown: {
      ethos: ethosNorm,
      xscore: xscoreNorm,
      reviews: review,
      engagement,
      followerAuthority: followerAuth,
      verifiedGigs,
      caseImpact,
    },
  };
}

export type LinkaryInfluenceInput = {
  ethosScore?: number | null;
  xscore?: number | null;
  verifiedReviewsCount?: number;
  activeAmbassadorsCount?: number;
  activeAffiliatesCount?: number;
  subsidiariesInfluence?: number[];
  engagementRate?: number | null;
  caseStudyDeltas?: number[] | null;
};

/**
 * Subsidiary influence: weighted avg of subsidiaries (influence 0-100) by followerAuthority.
 * Simplified: equal weight if no follower data.
 */
function subsidiaryInfluenceScore(
  _subsidiariesInfluence?: number[],
  _subsidiaryFollowers?: number[]
): number {
  const inf = _subsidiariesInfluence ?? [];
  if (!inf.length) return 0;
  const weights = _subsidiaryFollowers ?? inf.map(() => 1);
  let total = 0;
  let wSum = 0;
  for (let i = 0; i < inf.length; i++) {
    const w = Number.isFinite(weights[i]) ? Math.max(0, weights[i]) + 1 : 1;
    total += inf[i] * w;
    wSum += w;
  }
  return wSum ? scaleTo100(total / wSum / 100) : 0;
}

/**
 * Project Linkary Influence (0-1000).
 * Base 0-100: 15% Ethos, 15% XScore, 15% Reviews, 10% SocialEngagement, 15% CaseImpact,
 * 10% ActiveAmbassadors, 10% ActiveAffiliates, 10% SubsidiaryInfluence.
 */
export function computeLinkaryInfluence(input: LinkaryInfluenceInput): {
  score100: number;
  score1000: number;
  breakdown: Record<string, number>;
} {
  const ethos = scaleTo100((input.ethosScore ?? 0) / 100);
  const xscore = scaleTo100((input.xscore ?? 0) / 10);
  const reviews = reviewsScore(undefined, input.verifiedReviewsCount ?? 0);
  const socialEng = engagementScore(input.engagementRate);
  const caseImpact = caseImpactScore(input.caseStudyDeltas);
  const amb = scaleTo100(Math.min((input.activeAmbassadorsCount ?? 0) / 10, 1));
  const aff = scaleTo100(Math.min((input.activeAffiliatesCount ?? 0) / 5, 1));
  const sub = subsidiaryInfluenceScore(input.subsidiariesInfluence);

  const score100 =
    ethos * 0.15 +
    xscore * 0.15 +
    reviews * 0.15 +
    socialEng * 0.1 +
    caseImpact * 0.15 +
    amb * 0.1 +
    aff * 0.1 +
    sub * 0.1;
  const score1000 = Math.min(1000, Math.round(score100 * 10));

  return {
    score100: Math.round(score100 * 100) / 100,
    score1000,
    breakdown: {
      ethos,
      xscore,
      reviews,
      socialEngagement: socialEng,
      caseImpact,
      activeAmbassadors: amb,
      activeAffiliates: aff,
      subsidiaryInfluence: sub,
    },
  };
}
