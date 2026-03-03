/**
 * Print impression coverage for a profile (last 90 days): tweet_count, tweets_with_impressions, tweets_missing_impressions.
 * Run from repo root: pnpm exec tsx apps/web/scripts/impressionCoverage.ts --user bdd74100-fb07-409a-b235-943a90006ad9
 * Loads apps/web/.env.local. Requires NEXT_PUBLIC_SUPABASE_URL and SERVICE_ROLE_KEY (or SUPABASE_SERVICE_ROLE_KEY).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const envLocalPath = existsSync(resolve(process.cwd(), "apps/web/.env.local"))
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
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SERVICE_ROLE_KEY");
  process.exit(1);
}

function getProfileId(): string | null {
  const args = process.argv.slice(2);
  const i = args.indexOf("--user");
  if (i >= 0 && args[i + 1]) return args[i + 1];
  return process.env.PROFILE_ID ?? null;
}

async function main() {
  const profileId = getProfileId();
  if (!profileId) {
    console.error("Usage: pnpm exec tsx apps/web/scripts/impressionCoverage.ts --user YOUR_PROFILE_UUID");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setUTCDate(ninetyDaysAgo.getUTCDate() - 90);
  const since = ninetyDaysAgo.toISOString();

  const { data: rows, error } = await supabase
    .from("x_tweets")
    .select("impression_count")
    .eq("profile_id", profileId)
    .gte("tweeted_at", since);

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  const tweet_count = (rows ?? []).length;
  const tweets_with_impressions = (rows ?? []).filter((r) => (r?.impression_count ?? 0) > 0).length;
  const tweets_missing_impressions = tweet_count - tweets_with_impressions;

  console.log("Profile ID:", profileId);
  console.log("Last 90 days:");
  console.log("  tweet_count:", tweet_count);
  console.log("  tweets_with_impressions:", tweets_with_impressions);
  console.log("  tweets_missing_impressions:", tweets_missing_impressions);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
