/**
 * CLI / ops: populate crm_campaign_metrics_daily. Run from repo root:
 * pnpm sync:crm:campaign-metrics
 */
import { loadEnvConfig } from "@next/env";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { runCrmCampaignMetricsDailyIngest } from "../lib/crmCampaignMetricsDailyIngest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(__dirname, "../..");
loadEnvConfig(projectDir);

const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!url || !key) {
  console.error("[crm_campaign_metrics_daily] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function main() {
  const supabase = createClient(url, key);
  const result = await runCrmCampaignMetricsDailyIngest(supabase);
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
