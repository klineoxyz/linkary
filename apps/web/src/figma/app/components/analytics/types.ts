/**
 * Analytics UI types — contract-safe, matches /api/analytics/x response shape.
 * Do not change field names; backend contract is source of truth.
 */

export type WindowPeriod = "7D" | "30D" | "90D";

export type SnapshotPoint = {
  snapshot_date: string;
  followers_total: number | null;
  tweets_count?: number | null;
  likes_received?: number | null;
  engagement_rate?: number | null;
};

export type Baseline = {
  baseline_at?: string;
  baseline_date?: string;
  followers_total?: number | null;
  engagement_rate_proxy?: number | null;
  posts_30d?: number | null;
  avg_likes_30d?: number | null;
  avg_replies_30d?: number | null;
  reach_proxy_30d?: number | null;
} | null;

export type ChartPoints = {
  follower_growth: Array<{ date: string; follower_delta: number | null }>;
  engagement_rate: Array<{ date: string; engagement_pct: number; posts: number }>;
  posting_cadence: Array<{ date: string; posts: number }>;
} | null;

export type DataStatus = {
  tweet_count_7d?: number;
  tweet_count_30d?: number;
  tweet_count_90d?: number;
  last_tweet_at?: string | null;
  rollup_updated_at?: string | null;
} | null;

export interface XAnalyticsData {
  profile: {
    followers_total?: number;
    avg_engagement_rate?: number;
    x_last_profile_sync_at?: string | null;
    x_last_tweets_sync_at?: string | null;
    twitter_username?: string | null;
  };
  rollup: Record<string, unknown> | null;
  topDrivers: Array<{
    tweet_id: string;
    tweeted_at: string | null;
    like_count: number;
    reply_count: number;
    repost_count: number;
    engagement_score: number;
  }>;
  baseline: Baseline;
  snapshots?: SnapshotPoint[];
  source?: "worker" | "partial" | "fallback";
  chart_points?: ChartPoints;
  tweets_last_synced_at?: string | null;
  follower_last_synced_at?: string | null;
  follower_data_stale?: boolean;
  tweet_count_window?: number;
  follower_data_coverage_days?: number;
  follower_earliest_snapshot_date?: string | null;
  /** First day with non-null followers in window (truthful follower history). */
  follower_first_day?: string | null;
  follower_window_days?: number;
  snapshot_days_in_window?: number;
  engagement_data_coverage_days?: number;
  window_days?: number;
  engagement_rate_pct?: number | null;
  potential_reach_label?: string;
  potential_reach_is_estimated?: boolean;
  engagement_rate_is_estimated?: boolean;
  data_status?: DataStatus;
  freshness?: {
    tweets_last_synced_at: string | null;
    snapshot_max_day: string | null;
    aggregate_max_as_of: string | null;
  };
  debug?: Record<string, unknown>;
  diagnostics?: Record<string, unknown>;
}

/** KPI delta: null = not enough data (show "--" and "Not enough data"); number = real delta (round 1 decimal, arrow only if !== 0). */
export type KpiDelta = number | null;

export interface KpiCardData {
  id: string;
  label: string;
  value: string;
  /** null = show "--" + "Not enough data"; 0 = show "0%" no arrow; non-zero = round 1 decimal + arrow */
  delta: KpiDelta;
  helper: string;
  /** "Building" when insufficient data, "Active" when data present */
  badge: "Building" | "Active";
  /** Optional "Estimated" for engagement/reach when API says so */
  estimated?: boolean;
}

export interface TopDriverRow {
  tweet_id: string;
  date: string;
  time?: string;
  likes: number;
  replies: number;
  reposts: number;
  engagementRate: number;
  engagementOver100: boolean;
}
