/**
 * Daily cron: refresh X insights cache for eligible profiles by calling the web app refresh endpoint.
 * Eligible: x_connected = true AND twitter_username IS NOT NULL. Batch 50.
 * Requires: WEB_APP_URL, CRON_SECRET. If missing, exits 0 so cron does not fail.
 */
import { getSupabaseAdmin } from "./lib/supabase.js";

const BATCH_SIZE = 50;
const DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const baseUrl = (process.env.WEB_APP_URL ?? process.env.VERCEL_URL ?? "").trim().replace(/\/$/, "");
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!baseUrl || !cronSecret) {
    console.log("[sync_x_insights_daily] WEB_APP_URL or CRON_SECRET not set; skipping.");
    process.exit(0);
  }

  const webUrl = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  const supabase = getSupabaseAdmin();

  const { data: profiles, error: listError } = await supabase
    .from("profiles")
    .select("id, twitter_username")
    .eq("x_connected", true)
    .not("twitter_username", "is", null)
    .order("id")
    .limit(BATCH_SIZE);

  if (listError) {
    console.error("[sync_x_insights_daily] List error:", listError.message);
    process.exit(1);
  }

  const list = (profiles ?? []).filter(
    (p: { twitter_username: string | null }) => p.twitter_username && String(p.twitter_username).trim()
  );

  const start = Date.now();
  let ok = 0;
  let err = 0;
  let skipped = 0;

  for (const profile of list) {
    const username = String(profile.twitter_username).trim().replace(/^@/, "");
    if (!username) {
      skipped += 1;
      continue;
    }
    try {
      const res = await fetch(`${webUrl}/api/admin/social/x/refresh-insights`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cron-secret": cronSecret,
        },
        body: JSON.stringify({ username }),
      });
      await sleep(DELAY_MS);

      const body = await res.json().catch(() => ({}));
      if (res.ok && (body.ok === true || body.skipped === true)) {
        if (body.skipped === true) skipped += 1;
        else ok += 1;
      } else {
        err += 1;
        console.warn("[sync_x_insights_daily] refresh failed:", username, res.status, body);
      }
    } catch (e) {
      err += 1;
      console.warn("[sync_x_insights_daily] request error:", username, e);
    }
  }

  const duration = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `[sync_x_insights_daily] done. profiles=${list.length} ok=${ok} skipped=${skipped} errors=${err} duration=${duration}s`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
