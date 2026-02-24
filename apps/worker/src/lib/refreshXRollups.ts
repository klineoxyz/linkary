/**
 * Populate x_analytics_rollups and x_top_drivers from x_tweets for a profile.
 * Excludes retweets (text starting with "RT @") from rollups and top drivers.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isRetweetText, isOutlierTweet } from "./ingestXTweets.js";

const WINDOWS = [7, 30, 90] as const;
const TOP_DRIVERS_PER_WINDOW = 10;

function toDate(iso: string): string {
  return iso.slice(0, 10);
}

export async function refreshXRollupsForProfile(
  supabase: SupabaseClient,
  profileId: string
): Promise<void> {
  const now = new Date();
  const today = toDate(now.toISOString());

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("followers_total")
    .eq("id", profileId)
    .maybeSingle();
  const followersTotal =
    profileRow != null && (profileRow as { followers_total?: number }).followers_total != null
      ? Number((profileRow as { followers_total: number }).followers_total)
      : null;

  const rollup: Record<string, unknown> = {
    profile_id: profileId,
    updated_at: now.toISOString(),
    posts_7d: 0,
    posts_30d: 0,
    posts_90d: 0,
    avg_likes_7d: 0,
    avg_likes_30d: 0,
    avg_likes_90d: 0,
    avg_replies_7d: 0,
    avg_replies_30d: 0,
    avg_replies_90d: 0,
    engagement_rate_7d: 0,
    engagement_rate_30d: 0,
    engagement_rate_90d: 0,
    reach_proxy_7d: 0,
    reach_proxy_30d: 0,
    reach_proxy_90d: 0,
  };

  for (const days of WINDOWS) {
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    const startStr = toDate(start.toISOString());

    const { data: tweets, error } = await supabase
      .from("x_tweets")
      .select("tweet_id, tweeted_at, like_count, reply_count, repost_count, quote_count, text")
      .eq("profile_id", profileId)
      .gte("tweeted_at", startStr + "T00:00:00Z")
      .lte("tweeted_at", today + "T23:59:59Z");

    if (error) {
      console.warn("[ROLLUPS] x_tweets select error for profile " + profileId + " window " + days + ":", error.message);
      continue;
    }

    const raw = (tweets ?? []) as Array<{
      tweet_id: string;
      tweeted_at: string;
      like_count: number;
      reply_count: number;
      repost_count: number;
      quote_count: number;
      text?: string | null;
    }>;
    const list = raw
      .filter((t) => !isRetweetText(t.text))
      .filter((t) => !isOutlierTweet(t, followersTotal));

    const posts = list.length;
    const totalLikes = list.reduce((s, t) => s + (t.like_count ?? 0), 0);
    const totalReplies = list.reduce((s, t) => s + (t.reply_count ?? 0), 0);
    const totalEngagement = list.reduce(
      (s, t) =>
        s + (t.like_count ?? 0) + (t.reply_count ?? 0) + (t.repost_count ?? 0) + (t.quote_count ?? 0),
      0
    );
    const avgLikes = posts > 0 ? totalLikes / posts : 0;
    const avgReplies = posts > 0 ? totalReplies / posts : 0;
    const engagementRate = posts > 0 ? (totalEngagement / posts) : 0;
    const totalReposts = list.reduce((s, t) => s + (t.repost_count ?? 0), 0);
    const reachProxy = Math.round(totalLikes + totalReplies + totalReposts);

    rollup["posts_" + days + "d"] = posts;
    rollup["avg_likes_" + days + "d"] = Math.round(avgLikes * 100) / 100;
    rollup["avg_replies_" + days + "d"] = Math.round(avgReplies * 100) / 100;
    rollup["engagement_rate_" + days + "d"] = Math.round(engagementRate * 100) / 100;
    rollup["reach_proxy_" + days + "d"] = reachProxy;

    const topByEngagement = [...list]
      .map((t) => ({
        ...t,
        engagement: (t.like_count ?? 0) + (t.reply_count ?? 0) + (t.repost_count ?? 0),
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, TOP_DRIVERS_PER_WINDOW);

    await supabase.from("x_top_drivers").delete().eq("profile_id", profileId).eq("window_days", days);
    if (topByEngagement.length > 0) {
      const rows = topByEngagement.map((t) => ({
        profile_id: profileId,
        window_days: days,
        tweet_id: t.tweet_id,
        tweeted_at: t.tweeted_at,
        like_count: t.like_count ?? 0,
        reply_count: t.reply_count ?? 0,
        repost_count: t.repost_count ?? 0,
        engagement_score: (t.like_count ?? 0) + (t.reply_count ?? 0) + (t.repost_count ?? 0),
      }));
      await supabase.from("x_top_drivers").upsert(rows, {
        onConflict: "profile_id,window_days,tweet_id",
      });
    }
  }

  const { error: rollupErr } = await supabase.from("x_analytics_rollups").upsert(rollup, {
    onConflict: "profile_id",
  });
  if (rollupErr) {
    console.warn("[ROLLUPS] x_analytics_rollups upsert error for profile " + profileId + ":", rollupErr.message);
  }
}
