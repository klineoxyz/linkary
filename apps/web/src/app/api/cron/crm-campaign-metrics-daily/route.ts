import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { runCrmCampaignMetricsDailyIngest } from "@/lib/crmCampaignMetricsDailyIngest";

/**
 * Cron: aggregate tracked promoted X accounts into crm_campaign_metrics_daily from x_tweets.
 * Protected by CRON_SECRET. Schedule after tweet/profile sync so x_tweets is fresh.
 */
export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabase();
  const result = await runCrmCampaignMetricsDailyIngest(supabase);
  if (result.errors.length) {
    console.error("[cron crm-campaign-metrics-daily]", result.errors);
    return NextResponse.json(
      {
        ok: false,
        campaignsProcessed: result.campaignsProcessed,
        campaignsWithRows: result.campaignsWithRows,
        errors: result.errors,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    campaignsProcessed: result.campaignsProcessed,
    campaignsWithRows: result.campaignsWithRows,
  });
}
