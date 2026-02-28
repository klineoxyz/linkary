/**
 * Backfill profiles.avg_engagement_per_post from real engagement per post (not % * followers).
 * Priority: A = rollup avg_likes_30d + avg_replies_30d, B = x_tweets last 30d, C = rate * followers (last resort).
 * Run from repo root: pnpm run backfill-engagement, then pnpm run backfill-rep.
 * Updates all profiles that have a usable source (re-run to correct previously inflated rate*followers values).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const envLocalPath =
  existsSync(resolve(process.cwd(), "apps/web/.env.local"))
    ? resolve(process.cwd(), "apps/web/.env.local")
    : resolve(process.cwd(), ".env.local");
if (existsSync(envLocalPath)) {
  const content = readFileSync(envLocalPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing env. Exiting.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const DAY_30_MS = 30 * 24 * 60 * 60 * 1000;

async function main() {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, followers_total");

  const list = profiles ?? [];
  let processed = 0;
  let updated = 0;
  let skippedNoData = 0;

  for (const profile of list) {
    const profileId = profile.id as string;
    const followersTotal = Math.max(0, Number(profile.followers_total ?? 0));
    processed += 1;

    let value: number | null = null;
    let source = "";

    // Source A (preferred): rollup avg_likes_30d + avg_replies_30d = real engagement per post
    const { data: rollup } = await supabase
      .from("x_analytics_rollups")
      .select("posts_30d, engagement_rate_30d, avg_likes_30d, avg_replies_30d")
      .eq("profile_id", profileId)
      .maybeSingle();

    const rollupRow = rollup as { posts_30d?: number; engagement_rate_30d?: number; avg_likes_30d?: number; avg_replies_30d?: number } | null;
    const posts30d = Math.max(0, Number(rollupRow?.posts_30d ?? 0));
    const avgLikes = Number(rollupRow?.avg_likes_30d ?? 0);
    const avgReplies = Number(rollupRow?.avg_replies_30d ?? 0);

    if (rollupRow && posts30d > 0 && (Number.isFinite(avgLikes) || Number.isFinite(avgReplies))) {
      value = (Number.isFinite(avgLikes) ? avgLikes : 0) + (Number.isFinite(avgReplies) ? avgReplies : 0);
      source = "rollup_avg";
    }

    // Source B: x_tweets fallback (last 30 days): sum(like+reply+repost+quote) / max(posts, 1)
    if (value == null) {
      const windowStart = new Date(Date.now() - DAY_30_MS).toISOString();
      const { data: tweets } = await supabase
        .from("x_tweets")
        .select("like_count, reply_count, repost_count, quote_count")
        .eq("profile_id", profileId)
        .gte("tweeted_at", windowStart);

      const rows = (tweets ?? []) as Array<{ like_count?: number; reply_count?: number; repost_count?: number; quote_count?: number }>;
      const posts = rows.length;
      if (posts > 0) {
        const total = rows.reduce(
          (s, t) =>
            s +
            (Number(t.like_count ?? 0) + Number(t.reply_count ?? 0) + Number(t.repost_count ?? 0) + Number(t.quote_count ?? 0)),
          0
        );
        value = total / Math.max(posts, 1);
        source = "tweets";
      }
    }

    // Source C (last resort): engagement_rate_30d * followers_total / 100
    if (value == null && rollupRow) {
      const engagementRate30d = Number(rollupRow?.engagement_rate_30d ?? 0);
      if (Number.isFinite(engagementRate30d) && followersTotal > 0) {
        value = (engagementRate30d * followersTotal) / 100;
        source = "rate_fallback";
      }
    }

    if (value == null || !Number.isFinite(value)) {
      skippedNoData += 1;
      continue;
    }

    const clamped = Math.max(0, value);
    const { error } = await supabase
      .from("profiles")
      .update({
        avg_engagement_per_post: Math.round(clamped * 100) / 100,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profileId);

    if (error) {
      console.warn("Update failed for", profileId, error.message);
      continue;
    }
    updated += 1;
    console.log("[ENG_BACKFILL] profile_id=" + profileId + " value=" + clamped.toFixed(2) + " source=" + source);
  }

  console.log("\nDone. processed=" + processed + " updated=" + updated + " skipped_no_data=" + skippedNoData);
  if (updated > 0) {
    console.log("Run next: pnpm run backfill-rep");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
