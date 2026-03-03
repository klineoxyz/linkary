/**
 * Analytics DB audit: prove what data exists for a profile (x_daily_snapshots, x_tweets, x_window_aggregates).
 * Run from repo root: pnpm exec tsx apps/web/scripts/auditAnalyticsData.ts --user <profile_id>
 * Or: PROFILE_ID=<uuid> pnpm exec tsx apps/web/scripts/auditAnalyticsData.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY).
 *
 * Output is used for Phase 1 conclusion: "DB has 90D data" vs "DB does not have 90D data".
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

function getProfileId(): string | null {
  const args = process.argv.slice(2);
  const i = args.indexOf("--user");
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return process.env.PROFILE_ID ?? null;
}

const SQL_QUERIES = `
-- Copy-paste these into Supabase SQL editor (replace :profile_id with the profile UUID):

-- Snapshot counts per window (inclusive [today-6..today], [today-29..today], [today-89..today])
SELECT COUNT(*) AS snapshot_count_7d  FROM x_daily_snapshots WHERE owner_type='profile' AND owner_id = :profile_id AND day >= (CURRENT_DATE - 6)::text  AND day <= CURRENT_DATE::text;
SELECT COUNT(*) AS snapshot_count_30d FROM x_daily_snapshots WHERE owner_type='profile' AND owner_id = :profile_id AND day >= (CURRENT_DATE - 29)::text AND day <= CURRENT_DATE::text;
SELECT COUNT(*) AS snapshot_count_90d FROM x_daily_snapshots WHERE owner_type='profile' AND owner_id = :profile_id AND day >= (CURRENT_DATE - 89)::text AND day <= CURRENT_DATE::text;

-- Min/max snapshot day in last 90 days
SELECT MIN(day) AS min_day, MAX(day) AS max_day FROM x_daily_snapshots WHERE owner_type='profile' AND owner_id = :profile_id AND day >= (CURRENT_DATE - 89)::text AND day <= CURRENT_DATE::text;

-- Tweet count in last 90 days
SELECT COUNT(*) AS tweet_count_90d FROM x_tweets WHERE profile_id = :profile_id AND tweeted_at >= (NOW() - INTERVAL '90 days');

-- Window aggregates exist for 7/30/90?
SELECT window_days, COUNT(*) AS n FROM x_window_aggregates WHERE owner_type='profile' AND owner_id = :profile_id AND window_days IN (7, 30, 90) GROUP BY window_days;
`;

async function main() {
  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const profileId = getProfileId();
  if (!profileId) {
    console.error("Usage: pnpm exec tsx scripts/auditAnalyticsData.ts --user <profile_id>");
    console.error("   or: PROFILE_ID=<uuid> pnpm exec tsx scripts/auditAnalyticsData.ts");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const today = new Date().toISOString().slice(0, 10);
  const day7Start = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const day30Start = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const day90Start = new Date(Date.now() - 89 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  console.log("=== Analytics DB Audit ===\n");
  console.log("Profile ID:", profileId);
  console.log("Today (UTC date):", today);
  console.log("Window 7d:  [%s, %s]", day7Start, today);
  console.log("Window 30d: [%s, %s]", day30Start, today);
  console.log("Window 90d: [%s, %s]\n", day90Start, today);

  const [
    snap7,
    snap30,
    snap90,
    snapMinMax,
    tweets90,
    aggRows,
  ] = await Promise.all([
    supabase
      .from("x_daily_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("owner_type", "profile")
      .eq("owner_id", profileId)
      .gte("day", day7Start)
      .lte("day", today),
    supabase
      .from("x_daily_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("owner_type", "profile")
      .eq("owner_id", profileId)
      .gte("day", day30Start)
      .lte("day", today),
    supabase
      .from("x_daily_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("owner_type", "profile")
      .eq("owner_id", profileId)
      .gte("day", day90Start)
      .lte("day", today),
    supabase
      .from("x_daily_snapshots")
      .select("day")
      .eq("owner_type", "profile")
      .eq("owner_id", profileId)
      .gte("day", day90Start)
      .lte("day", today)
      .order("day", { ascending: true }),
    supabase
      .from("x_tweets")
      .select("tweet_id", { count: "exact", head: true })
      .eq("profile_id", profileId)
      .gte("tweeted_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("x_window_aggregates")
      .select("window_days")
      .eq("owner_type", "profile")
      .eq("owner_id", profileId)
      .in("window_days", [7, 30, 90]),
  ]);

  const snapshot_count_7d = snap7.count ?? 0;
  const snapshot_count_30d = snap30.count ?? 0;
  const snapshot_count_90d = snap90.count ?? 0;
  const tweet_count_90d = tweets90.count ?? 0;
  const snapDays = (snapMinMax.data ?? []) as { day: string }[];
  const minDay = snapDays.length > 0 ? snapDays.reduce((a, r) => (r.day < a ? r.day : a), snapDays[0].day) : null;
  const maxDay = snapDays.length > 0 ? snapDays.reduce((a, r) => (r.day > a ? r.day : a), snapDays[0].day) : null;
  const aggByWindow = (aggRows.data ?? []).reduce((acc: Record<number, number>, r: { window_days?: number }) => {
    const w = r.window_days;
    if (typeof w === "number") acc[w] = (acc[w] ?? 0) + 1;
    return acc;
  }, {});

  console.log("--- Results ---");
  console.log("Snapshot count (7d):   ", snapshot_count_7d);
  console.log("Snapshot count (30d):  ", snapshot_count_30d);
  console.log("Snapshot count (90d): ", snapshot_count_90d);
  console.log("Snapshot min date (90d window):", minDay ?? "none");
  console.log("Snapshot max date (90d window):", maxDay ?? "none");
  console.log("Tweet count (90d):    ", tweet_count_90d);
  console.log("Window aggregates:    7d=%s, 30d=%s, 90d=%s", aggByWindow[7] ?? 0, aggByWindow[30] ?? 0, aggByWindow[90] ?? 0);
  console.log("");

  const has90dSnapshots = snapshot_count_90d >= 1;
  const has90dTweets = tweet_count_90d >= 1;
  const has90dAggregate = (aggByWindow[90] ?? 0) >= 1;

  if (has90dSnapshots || has90dTweets) {
    console.log("Conclusion (DB): DB HAS data in 90d window (snapshots and/or tweets). API and UI should show it.");
  } else {
    console.log("Conclusion (DB): DB DOES NOT have 90d data for this profile. Check collector/backfill (cron, worker, twitterapi.io).");
  }

  console.log("\n--- SQL equivalents (for PR) ---");
  console.log(SQL_QUERIES);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
