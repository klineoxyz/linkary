/**
 * Phase 5: Unified social insights contract for multi-provider (X, TikTok, YouTube).
 * Used by GET /api/social/insights?provider=... No UI gating.
 */
export type SocialProvider = "x" | "tiktok" | "youtube";

export interface UnifiedInsightsProfile {
  username: string;
  followers: number | null;
  following: number | null;
  posts: number | null;
  joinedAt: string | null;
}

export interface UnifiedTopFollowerItem {
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  followers?: number | null;
  tier?: string | null;
}

export interface UnifiedCacheBucketMeta {
  status: "hit" | "miss" | "stale";
  updatedAt?: string | null;
}

export interface UnifiedCacheMeta {
  topFollowers: UnifiedCacheBucketMeta | ("hit" | "miss" | "stale");
  feed: UnifiedCacheBucketMeta | ("hit" | "miss" | "stale");
  mentions: UnifiedCacheBucketMeta | ("hit" | "miss" | "stale");
}

export interface UnifiedInsightsResponse {
  provider: SocialProvider;
  profile: UnifiedInsightsProfile;
  topFollowersByTier: {
    influencers: UnifiedTopFollowerItem[];
    projects: UnifiedTopFollowerItem[];
    funds: UnifiedTopFollowerItem[];
  };
  mentionsLastWeek: unknown[];
  affiliatedAccounts: unknown[];
  accountFeed: {
    actions: unknown[];
    newFollowers: unknown[];
  };
  /** Optional: series and recommendedAccounts when provider=x */
  series?: { followers: Array<{ date: string; value: number }>; score: Array<{ date: string; value: number }> };
  recommendedAccounts?: unknown[];
  meta: {
    cache: UnifiedCacheMeta;
    providerVersion: 1;
  };
}

/** Empty response for a provider (cache miss or not implemented). */
export function emptyUnifiedInsights(provider: SocialProvider): UnifiedInsightsResponse {
  return {
    provider,
    profile: {
      username: "",
      followers: null,
      following: null,
      posts: null,
      joinedAt: null,
    },
    topFollowersByTier: { influencers: [], projects: [], funds: [] },
    mentionsLastWeek: [],
    affiliatedAccounts: [],
    accountFeed: { actions: [], newFollowers: [] },
    meta: {
      cache: {
        topFollowers: { status: "miss" as const, updatedAt: null },
        feed: { status: "miss" as const, updatedAt: null },
        mentions: { status: "miss" as const, updatedAt: null },
      },
      providerVersion: 1,
    },
  };
}
