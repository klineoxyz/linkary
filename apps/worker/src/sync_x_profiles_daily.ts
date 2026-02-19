/**
 * Daily cron: sync X profile info (followers, avatar, bio, display_name) + insert snapshot.
 * Eligible: is_indexed, twitter_connected_at not null, twitter_username not null,
 * and (x_last_profile_sync_at is null or older than 24h).
 */
import { getSupabaseAdmin } from "./lib/supabase.js";
import { getUserInfo } from "./lib/twitterapi.js";
import { sleep, normalizeHandle } from "./lib/utils.js";

const BATCH_SIZE = 100;
const DELAY_MS = 150;

async function main() {
  const supabase = getSupabaseAdmin();
  const past24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: profiles, error: listError } = await supabase
    .from("profiles")
    .select("id, twitter_username")
    .eq("is_indexed", true)
    .not("twitter_username", "is", null)
    .not("twitter_connected_at", "is", null)
    .or(`x_last_profile_sync_at.is.null,x_last_profile_sync_at.lt.${past24}`)
    .order("id")
    .limit(BATCH_SIZE);

  if (listError) {
    console.error("Failed to list profiles:", listError.message);
    process.exit(1);
  }

  const list = (profiles ?? []).filter(
    (p: { twitter_username: string | null }) => p.twitter_username && String(p.twitter_username).trim()
  );
  const today = new Date().toISOString().slice(0, 10);
  let ok = 0;
  let err = 0;
  let skipped = 0;

  for (const profile of list) {
    const handle = normalizeHandle(String(profile.twitter_username));
    if (!handle) {
      skipped += 1;
      continue;
    }
    try {
      const info = await getUserInfo(handle);
      await sleep(DELAY_MS);

      if (!info) {
        await supabase
          .from("profiles")
          .update({
            x_sync_status: "error",
            x_sync_error: "User info not found or API error",
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.id);
        err += 1;
        continue;
      }

      const followers = typeof info.followers === "number" ? info.followers : 0;
      const statusesCount = typeof info.statusesCount === "number" ? info.statusesCount : 0;
      const favouritesCount = typeof info.favouritesCount === "number" ? info.favouritesCount : 0;
      const engagementRate =
        followers > 0
          ? Math.min(100, Math.round(((statusesCount + favouritesCount) / followers) * 1000) / 10)
          : 0;

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          followers_total: followers,
          display_name: (info.name ?? "").trim() || null,
          bio: (info.description ?? "").trim() || null,
          avatar_url: (info.profilePicture ?? "").trim() || null,
          avg_engagement_rate: engagementRate,
          updated_at: new Date().toISOString(),
          x_last_profile_sync_at: new Date().toISOString(),
          x_sync_status: "ok",
          x_sync_error: null,
        })
        .eq("id", profile.id);

      if (updateErr) {
        await supabase
          .from("profiles")
          .update({
            x_sync_status: "error",
            x_sync_error: updateErr.message?.slice(0, 500) ?? "Update failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.id);
        err += 1;
        continue;
      }

      await supabase.from("analytics_snapshots").upsert(
        {
          profile_id: profile.id,
          platform: "x",
          snapshot_date: today,
          followers_total: followers,
          engagement_rate_proxy: engagementRate,
        },
        { onConflict: "profile_id,platform,snapshot_date" }
      );

      // One-time baseline for "growth since joining" (first insert wins; ignore duplicate)
      const { error: baselineErr } = await supabase.from("profile_analytics_baseline").insert({
        profile_id: profile.id,
        platform: "x",
        followers_total: followers,
        engagement_rate_proxy: engagementRate,
      });
      if (baselineErr && baselineErr.code !== "23505") {
        console.warn("Baseline insert warning:", profile.id, baselineErr.message);
      }
      ok += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase
        .from("profiles")
        .update({
          x_sync_status: "error",
          x_sync_error: msg.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);
      err += 1;
    }
  }

  console.log(`Daily sync done. processed=${list.length} ok=${ok} errors=${err} skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
