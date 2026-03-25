/**
 * CLI / ops: populate crm_campaign_metrics_daily. Run from repo root:
 * pnpm sync:crm:campaign-metrics
 */
import { resolve } from "path";
import { readFileSync, existsSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { runCrmCampaignMetricsDailyIngest } from "../lib/crmCampaignMetricsDailyIngest";

// This script is invoked from repo root via pnpm.
const projectDir = resolve(process.cwd(), "apps/web");

function loadEnvLocalFallback() {
  const envLocalPath = resolve(projectDir, ".env.local");
  if (!existsSync(envLocalPath)) return;
  const content = readFileSync(envLocalPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const k = trimmed.slice(0, idx).trim();
    const v = trimmed.slice(idx + 1).trim();
    if (!k) continue;
    if (process.env[k] == null || process.env[k] === "") {
      process.env[k] = v;
    }
  }
}

loadEnvLocalFallback();

const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const key = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SERVICE_ROLE_KEY ||
  ""
).trim();

if (!url || !key) {
  console.error(
    "[crm_campaign_metrics_daily] Missing URL (SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL) or service role key (SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY)"
  );
  process.exit(1);
}

async function main() {
  const supabase = createClient(url, key);
  const twitterApiKey =
    (process.env.TWITTERAPI_API_KEY ||
      process.env.TWITTERAPI_IO_KEY ||
      process.env.TWITTERAPI_KEY ||
      "")
      .trim() || null;
  const result = await runCrmCampaignMetricsDailyIngest(supabase, { twitterApiKey });
  console.log(
    "[crm_campaign_metrics_daily] done processed=%d with_daily_rows=%d errors=%d",
    result.campaignsProcessed,
    result.campaignsWithRows,
    result.errors.length
  );
  if (result.errors.length) {
    for (const e of result.errors) console.error("[crm_campaign_metrics_daily]", e);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
