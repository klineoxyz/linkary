/**
 * GET /api/analytics/x — Contract-locked v2.
 * Always returns JSON: { ok: true, data } or { ok: false, code, message }.
 * Engagement series from x_tweets only (no x_daily_snapshots.engagement_rate).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { isPlanGatingEnabled } from "@/lib/planGating";
import { profileHasCompScope } from "@/lib/opsEntitlementsMerge";
import { effectiveDeepAnalytics } from "@/lib/planCompGate";
import { planKeyFromSubscriptionRow, type PlanKey } from "@/lib/planKey";
import { resolveEffectivePlanKeyForProfile } from "@/lib/subscriptionPlan";
import { shouldGrantDeepAnalyticsBeyondPlan } from "@/lib/analyticsDeepEntitlement";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type WindowParam = "7d" | "30d" | "90d";

function ok(payload: unknown) {
  return NextResponse.json({ ok: true as const, data: payload });
}

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false as const, code, message }, { status });
}

const ER_CAP_PCT = 50;

export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return fail("UNAUTHORIZED", "Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url ?? "", "http://localhost");
    const windowRaw = (searchParams.get("window") ?? "30d").toLowerCase();
    const window: WindowParam = windowRaw === "7d" || windowRaw === "90d" ? windowRaw : "30d";
    const windowDays = window === "7d" ? 7 : window === "30d" ? 30 : 90;
    const debug = searchParams.get("debug") === "1";

    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    let supabase!: SupabaseClient;
    let userId: string | undefined;
    let auth_mode: "bearer" | "cookie" = "cookie";

    if (bearerToken) {
      const bearerClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${bearerToken}` } },
      });
      const { data: { user }, error: userError } = await bearerClient.auth.getUser(bearerToken);
      if (!userError && user?.id) {
        supabase = bearerClient;
        userId = user.id;
        auth_mode = "bearer";
      }
    }

    if (userId === undefined) {
      const serverSupabase = await createServerSupabase();
      const { data: { session } } = await serverSupabase.auth.getSession();
      if (session?.user?.id) {
        supabase = serverSupabase as SupabaseClient;
        userId = session.user.id;
        auth_mode = "cookie";
      }
    }

    if (!userId) {
      return fail("UNAUTHORIZED", "Unauthorized", 401);
    }

    const { data: authUserData } = await supabase.auth.getUser();
    const userEmail = authUserData?.user?.email ?? null;

    const utcDayStr = (d: Date) => d.toISOString().slice(0, 10);
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const windowStartUTC = new Date(todayUTC);
    windowStartUTC.setUTCDate(windowStartUTC.getUTCDate() - (windowDays - 1));
    const windowStartStr = utcDayStr(windowStartUTC);
    const windowEndStr = utcDayStr(todayUTC);

    const windowStart = windowStartStr;
    const window_end = windowEndStr;

    const priorEndUTC = new Date(windowStartUTC);
    priorEndUTC.setUTCDate(priorEndUTC.getUTCDate() - 1);
    const priorStartUTC = new Date(priorEndUTC);
    priorStartUTC.setUTCDate(priorStartUTC.getUTCDate() - (windowDays - 1));
    const priorStartStr = utcDayStr(priorStartUTC);
    const priorEndStr = utcDayStr(priorEndUTC);

    const tweetsFrom = new Date(priorStartUTC);
    const tweetsFromStr = tweetsFrom.toISOString();

    const [dailySnapshotsRes, baselineSnapshotRes, tweetsRes, profileRes] = await Promise.all([
      supabase
        .from("x_daily_snapshots")
        .select("day, followers")
        .eq("owner_type", "profile")
        .eq("owner_id", userId)
        .gte("day", windowStartStr)
        .lte("day", windowEndStr)
        .order("day", { ascending: true }),
      supabase
        .from("x_daily_snapshots")
        .select("day, followers")
        .eq("owner_type", "profile")
        .eq("owner_id", userId)
        .lt("day", windowStartStr)
        .not("followers", "is", null)
        .order("day", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("x_tweets")
        .select("tweeted_at, like_count, reply_count, repost_count, quote_count, impression_count")
        .eq("profile_id", userId)
        .gte("tweeted_at", tweetsFromStr)
        .order("tweeted_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("twitter_username, x_last_profile_sync_at")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    type SnapshotRow = { day: string; followers: number | null };
    type TweetRow = {
      tweeted_at: string;
      like_count: number;
      reply_count: number;
      repost_count: number;
      quote_count?: number | null;
      impression_count?: number | null;
    };

    const dailyRows = (dailySnapshotsRes.data ?? []) as SnapshotRow[];
    const tweets = (tweetsRes.data ?? []) as TweetRow[];

    const fullWindowDates: string[] = [];
    for (let i = 0; i < windowDays; i++) {
      const d = new Date(windowStartUTC);
      d.setUTCDate(d.getUTCDate() + i);
      fullWindowDates.push(utcDayStr(d));
    }
    fullWindowDates.sort((a, b) => a.localeCompare(b));

    const dayAgg = new Map<string, { posts: number; totalEng: number; impressions: number }>();
    for (const t of tweets) {
      const day = t.tweeted_at?.slice(0, 10) ?? "";
      if (!day || day < windowStartStr || day > window_end) continue;
      const cur = dayAgg.get(day) ?? { posts: 0, totalEng: 0, impressions: 0 };
      cur.posts += 1;
      cur.totalEng +=
        (Number(t.like_count) || 0) +
        (Number(t.reply_count) || 0) +
        (Number(t.repost_count) || 0) +
        (Number(t.quote_count) || 0);
      cur.impressions += Number(t.impression_count) || 0;
      dayAgg.set(day, cur);
    }

    const engagement_rate: Array<{
      date: string;
      engagement_pct: number;
      posts: number;
      is_estimated?: false;
      is_capped?: boolean;
    }> = fullWindowDates.map((date) => {
      const agg = dayAgg.get(date) ?? { posts: 0, totalEng: 0, impressions: 0 };
      const engagement_pct_raw =
        agg.impressions > 0 ? (agg.totalEng / agg.impressions) * 100 : 0;
      const engagement_pct = Math.min(engagement_pct_raw, ER_CAP_PCT);
      const is_capped = engagement_pct_raw > ER_CAP_PCT;
      return {
        date,
        engagement_pct,
        posts: agg.posts,
        ...(is_capped ? { is_capped: true } : {}),
      };
    });

    const posting_cadence: Array<{ date: string; posts: number }> = fullWindowDates.map((date) => ({
      date,
      posts: dayAgg.get(date)?.posts ?? 0,
    }));

    const followerSnapshots = dailyRows
      .filter(
        (r) =>
          r.day >= windowStartStr &&
          r.day <= window_end &&
          r.followers != null &&
          Number.isFinite(Number(r.followers))
      )
      .map((r) => ({ day: r.day, followers: Number(r.followers) as number }))
      .sort((a, b) => a.day.localeCompare(b.day));

    const follower_data_coverage_days = followerSnapshots.length;

    const baselineRow = baselineSnapshotRes.data as { day?: string; followers?: number | null } | null;
    const baselineFollowers =
      baselineRow?.followers != null && Number.isFinite(Number(baselineRow.followers))
        ? Number(baselineRow.followers)
        : null;

    const followersByDay = new Map<string, number>();
    for (const s of followerSnapshots) {
      followersByDay.set(s.day, s.followers);
    }

    /** One point per calendar day in the window; forward-fill counts; null delta only when we have no known follower level at all. */
    const follower_growth: Array<{ date: string; follower_delta: number | null }> = [];
    const firstWindowFollowers = followerSnapshots.length > 0 ? followerSnapshots[0].followers : null;
    // If we have at least one in-window snapshot but no pre-window baseline, backfill prior days as flat.
    let prevLevel: number | null = baselineFollowers ?? firstWindowFollowers;
    for (const date of fullWindowDates) {
      const snap = followersByDay.get(date);
      const level =
        snap != null && Number.isFinite(snap) ? snap : prevLevel != null && Number.isFinite(prevLevel) ? prevLevel : null;

      if (level == null || !Number.isFinite(level)) {
        follower_growth.push({ date, follower_delta: null });
        continue;
      }

      if (prevLevel == null || !Number.isFinite(prevLevel)) {
        follower_growth.push({ date, follower_delta: 0 });
        prevLevel = level;
        continue;
      }

      follower_growth.push({ date, follower_delta: level - prevLevel });
      prevLevel = level;
    }

    const tweetsInWindow = tweets.filter((t) => {
      const d = (t.tweeted_at ?? "").slice(0, 10);
      return d >= windowStartStr && d <= window_end;
    });
    const tweetsInPriorWindow = tweets.filter((t) => {
      const d = (t.tweeted_at ?? "").slice(0, 10);
      return d >= priorStartStr && d <= priorEndStr;
    });

    const posts_total = tweetsInWindow.length;
    const total_likes = tweetsInWindow.reduce((s, t) => s + (Number(t.like_count) || 0), 0);
    const total_replies = tweetsInWindow.reduce((s, t) => s + (Number(t.reply_count) || 0), 0);
    const engagements_total = tweetsInWindow.reduce(
      (s, t) =>
        s +
        (Number(t.like_count) || 0) +
        (Number(t.reply_count) || 0) +
        (Number(t.repost_count) || 0) +
        (Number(t.quote_count) || 0),
      0
    );
    const impressions_total = tweetsInWindow.reduce(
      (s, t) => s + (Number(t.impression_count) || 0),
      0
    );
    const engagement_pct_avg =
      impressions_total > 0 ? (engagements_total / impressions_total) * 100 : 0;
    const avg_likes_per_post = posts_total > 0 ? total_likes / posts_total : 0;
    const avg_replies_per_post = posts_total > 0 ? total_replies / posts_total : 0;
    const followers_latest =
      followerSnapshots.length > 0
        ? followerSnapshots[followerSnapshots.length - 1].followers
        : null;
    const potential_reach = impressions_total;

    const prior_posts = tweetsInPriorWindow.length;
    const prior_engagements = tweetsInPriorWindow.reduce(
      (s, t) =>
        s +
        (Number(t.like_count) || 0) +
        (Number(t.reply_count) || 0) +
        (Number(t.repost_count) || 0) +
        (Number(t.quote_count) || 0),
      0
    );
    const prior_impressions = tweetsInPriorWindow.reduce(
      (s, t) => s + (Number(t.impression_count) || 0),
      0
    );
    const prior_likes = tweetsInPriorWindow.reduce((s, t) => s + (Number(t.like_count) || 0), 0);
    const prior_replies = tweetsInPriorWindow.reduce((s, t) => s + (Number(t.reply_count) || 0), 0);

    const chart_points = {
      engagement_rate,
      posting_cadence,
      follower_growth,
    };

    const kpis = {
      posts_total,
      impressions_total,
      engagements_total,
      engagement_pct_avg,
      followers_latest,
      avg_likes_per_post,
      avg_replies_per_post,
      potential_reach,
      prior_potential_reach: prior_impressions,
      prior_engagements_total: prior_engagements,
      prior_posts_total: prior_posts,
      prior_avg_likes_per_post: prior_posts > 0 ? prior_likes / prior_posts : 0,
      prior_avg_replies_per_post: prior_posts > 0 ? prior_replies / prior_posts : 0,
    };

    const profileRow = profileRes.data as { twitter_username?: string | null; x_last_profile_sync_at?: string | null } | null;
    const hasXHandle = !!(profileRow?.twitter_username ?? "").trim().replace(/^@/, "");
    const lastSyncAt = profileRow?.x_last_profile_sync_at ?? null;
    const hasAnyData = follower_data_coverage_days > 0 || posts_total > 0;
    const dataState: "none" | "partial" | "full" =
      !hasAnyData ? "none" : follower_data_coverage_days >= 7 && posts_total > 0 ? "full" : "partial";

    const payload: Record<string, unknown> = {
      window_days: windowDays,
      window_start: windowStart,
      window_end: window_end,
      follower_data_coverage_days,
      chart_points,
      kpis,
      freshness: {
        has_x_handle: hasXHandle,
        last_sync_at: lastSyncAt,
        data_state: dataState,
      },
    };

    if (debug) {
      payload.debug = {
        auth_mode,
      };
    }

    if (isPlanGatingEnabled()) {
      const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
      let planKey: PlanKey = "free";
      let compDeep = false;
      let serviceClient: ReturnType<typeof createClient> | null = null;
      if (svcKey) {
        serviceClient = createClient(supabaseUrl, svcKey);
        planKey = await resolveEffectivePlanKeyForProfile(serviceClient, userId);
        compDeep = await profileHasCompScope(serviceClient, userId, "analytics_full");
      } else {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("plan_key, tier, status, current_period_end")
          .eq("owner_type", "profile")
          .eq("owner_id", userId)
          .maybeSingle();
        planKey = planKeyFromSubscriptionRow(
          sub as Parameters<typeof planKeyFromSubscriptionRow>[0]
        );
      }
      let allowDeep = effectiveDeepAnalytics(planKey, compDeep ? new Set(["analytics_full"] as const) : undefined);
      if (!allowDeep) {
        const granted = await shouldGrantDeepAnalyticsBeyondPlan({
          userId,
          userEmail,
          service: serviceClient,
          userSupabase: supabase,
        });
        if (granted) {
          allowDeep = true;
        }
      }
      if (!allowDeep) {
        const k = kpis as Record<string, unknown>;
        payload.analytics_entitlement = "basic";
        payload.chart_points = {
          engagement_rate: [],
          posting_cadence: [],
          follower_growth: [],
        };
        payload.kpis = {
          posts_total: k.posts_total,
          impressions_total: k.impressions_total,
          engagements_total: k.engagements_total,
          followers_latest: k.followers_latest,
          avg_likes_per_post: k.avg_likes_per_post,
          potential_reach: k.potential_reach,
        };
      } else {
        payload.analytics_entitlement = "full";
      }
    }

    return ok(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return fail("SERVER_ERROR", message, 500);
  }
}
