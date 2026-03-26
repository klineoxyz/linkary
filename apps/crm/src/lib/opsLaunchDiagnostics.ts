/**
 * Launch / ops diagnostics: read-only Supabase signals for ingestion freshness,
 * analytics queue state, and env presence (booleans only — never expose secrets).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const CRM_STATUSES = ["draft", "active", "paused", "completed"] as const;

/** Hours after which CRM daily metrics rows are considered stale if nothing newer was written. */
const STALE_CRM_METRICS_HOURS = 42;
/** Hours after which profile X tweet sync is flagged if no row is newer. */
const STALE_PROFILE_SYNC_HOURS = 30;

export type OpsLaunchDiagnostics = {
  generatedAt: string;
  thresholds: {
    crm_metrics_stale_after_hours: number;
    profile_sync_stale_after_hours: number;
  };
  crmCampaignMetricsDaily: {
    last_row_created_at: string | null;
    rows_written_last_24h: number | null;
    is_stale: boolean;
    stale_reason: string | null;
  };
  campaign_layer1: {
    campaigns_in_scope: number | null;
    distinct_campaigns_with_daily_rows: number | null;
    campaigns_missing_layer1_count: number | null;
    campaigns_missing_layer1_sample: Array<{
      id: string;
      title: string | null;
      status: string | null;
    }>;
  };
  x_pipeline: {
    latest_x_last_tweets_sync_at: string | null;
    profiles_with_x_sync_count: number | null;
    x_tweets_rows_created_last_24h: number | null;
    latest_x_tweet_row_created_at: string | null;
    x_daily_snapshots_latest_day: string | null;
    x_daily_snapshots_latest_created_at: string | null;
  };
  analytics_jobs: {
    queued: number | null;
    running: number | null;
    failed_last_10: Array<{
      id: string;
      job_type: string;
      status: string;
      updated_at: string;
      last_error: string | null;
      attempts: number;
    }>;
    last_done_backfill_at: string | null;
  };
  /** Boolean presence only — safe for UI. */
  env_flags: {
    NEXT_PUBLIC_SUPABASE_URL: boolean;
    NEXT_PUBLIC_SUPABASE_ANON_KEY: boolean;
    SUPABASE_SERVICE_ROLE_KEY: boolean;
    NEXT_PUBLIC_APP_URL: boolean;
    CRM_SYNC_SECRET: boolean;
    twitterapi_key_any: boolean;
    NEXT_PUBLIC_COOKIE_DOMAIN: boolean;
  };
  warnings: string[];
};

function hoursBetween(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return (Date.now() - t) / (60 * 60 * 1000);
}

export async function fetchOpsLaunchDiagnostics(service: SupabaseClient): Promise<OpsLaunchDiagnostics> {
  const generatedAt = new Date().toISOString();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const env_flags: OpsLaunchDiagnostics["env_flags"] = {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
    NEXT_PUBLIC_APP_URL: !!process.env.NEXT_PUBLIC_APP_URL?.trim(),
    CRM_SYNC_SECRET: !!process.env.CRM_SYNC_SECRET?.trim(),
    twitterapi_key_any: !!(
      process.env.TWITTERAPI_API_KEY?.trim() ||
      process.env.TWITTERAPI_IO_KEY?.trim() ||
      process.env.TWITTERAPI_KEY?.trim() ||
      process.env.TWITTERAPI_TOKEN?.trim()
    ),
    NEXT_PUBLIC_COOKIE_DOMAIN: !!process.env.NEXT_PUBLIC_COOKIE_DOMAIN?.trim(),
  };

  const [
    latestMetricRes,
    metrics24hRes,
    campaignsScopeRes,
    metricsCampaignRes,
    latestSyncProfileRes,
    tweets24hRes,
    latestTweetCreatedRes,
    latestSnapshotRes,
    jobQueuedRes,
    jobRunningRes,
    failedJobsRes,
    lastDoneBackfillRes,
    profilesWithSyncRes,
  ] = await Promise.all([
    service
      .from("crm_campaign_metrics_daily")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from("crm_campaign_metrics_daily")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo),
    service
      .from("crm_campaigns")
      .select("id", { count: "exact", head: true })
      .in("status", [...CRM_STATUSES]),
    service.from("crm_campaign_metrics_daily").select("campaign_id").limit(100000),
    service
      .from("profiles")
      .select("x_last_tweets_sync_at")
      .not("x_last_tweets_sync_at", "is", null)
      .order("x_last_tweets_sync_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from("x_tweets")
      .select("id", { count: "exact", head: true })
      .gte("created_at", dayAgo),
    service
      .from("x_tweets")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from("x_daily_snapshots")
      .select("day, created_at")
      .order("day", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from("analytics_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued"),
    service
      .from("analytics_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "running"),
    service
      .from("analytics_jobs")
      .select("id, job_type, status, updated_at, last_error, attempts")
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(10),
    service
      .from("analytics_jobs")
      .select("updated_at")
      .eq("job_type", "x_backfill_90d")
      .eq("status", "done")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    service
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .not("x_last_tweets_sync_at", "is", null),
  ]);

  const last_row_created_at =
    (latestMetricRes.data as { created_at?: string } | null)?.created_at ?? null;
  const h = hoursBetween(last_row_created_at);
  const is_stale = h != null && h > STALE_CRM_METRICS_HOURS;
  const crmCampaignMetricsDaily = {
    last_row_created_at,
    rows_written_last_24h: metrics24hRes.count ?? null,
    is_stale,
    stale_reason: is_stale
      ? `No new \`crm_campaign_metrics_daily\` row in the last ${STALE_CRM_METRICS_HOURS}h (latest write ${last_row_created_at ?? "—"}).`
      : last_row_created_at
        ? null
        : "No rows in `crm_campaign_metrics_daily` yet.",
  };

  const campaigns_in_scope = campaignsScopeRes.count ?? null;
  const mcRows = (metricsCampaignRes.data ?? []) as Array<{ campaign_id: string }>;
  const withDaily = new Set(mcRows.map((r) => r.campaign_id));
  const distinct_campaigns_with_daily_rows = withDaily.size;

  let campaigns_missing_layer1_sample: OpsLaunchDiagnostics["campaign_layer1"]["campaigns_missing_layer1_sample"] =
    [];
  let campaigns_missing_layer1_count: number | null = null;

  if (campaigns_in_scope != null) {
    const { data: campRows } = await service
      .from("crm_campaigns")
      .select("id, title, status")
      .in("status", [...CRM_STATUSES])
      .order("updated_at", { ascending: false })
      .limit(4000);

    const all = (campRows ?? []) as Array<{ id: string; title: string | null; status: string | null }>;
    const missing = all.filter((c) => !withDaily.has(c.id));
    campaigns_missing_layer1_count = missing.length;
    campaigns_missing_layer1_sample = missing.slice(0, 25);
  }

  const latest_x_last_tweets_sync_at =
    (latestSyncProfileRes.data as { x_last_tweets_sync_at?: string } | null)?.x_last_tweets_sync_at ?? null;
  const syncH = hoursBetween(latest_x_last_tweets_sync_at);

  const warnings: string[] = [];
  if (!last_row_created_at && (campaigns_in_scope ?? 0) > 0) {
    warnings.push(
      "Campaigns exist in CRM but `crm_campaign_metrics_daily` has no rows — run the web cron `POST /api/cron/crm-campaign-metrics-daily` (CRON_SECRET) or the packaged sync job."
    );
  }
  if (is_stale && crmCampaignMetricsDaily.stale_reason) {
    warnings.push(crmCampaignMetricsDaily.stale_reason);
  }
  if (syncH != null && syncH > STALE_PROFILE_SYNC_HOURS) {
    warnings.push(
      `Latest \`profiles.x_last_tweets_sync_at\` is older than ${STALE_PROFILE_SYNC_HOURS}h — X tweet ingestion may be stalled (check Railway worker / sync:x:tweets:daily).`
    );
  }
  if ((jobQueuedRes.count ?? 0) > 500) {
    warnings.push(`Analytics job queue is large (${jobQueuedRes.count} queued) — check linkary-queue-drainer / worker.`);
  }
  if ((failedJobsRes.data ?? []).length > 0) {
    warnings.push(
      `There are failed \`analytics_jobs\` rows — review the table below (last errors may be stale if already retried).`
    );
  }
  if (!env_flags.SUPABASE_SERVICE_ROLE_KEY) {
    warnings.push("SUPABASE_SERVICE_ROLE_KEY is missing — CRM server features and ops reads will fail.");
  }
  if (!env_flags.NEXT_PUBLIC_APP_URL) {
    warnings.push("NEXT_PUBLIC_APP_URL is unset — OAuth redirects and absolute links may be wrong in production.");
  }

  return {
    generatedAt,
    thresholds: {
      crm_metrics_stale_after_hours: STALE_CRM_METRICS_HOURS,
      profile_sync_stale_after_hours: STALE_PROFILE_SYNC_HOURS,
    },
    crmCampaignMetricsDaily: crmCampaignMetricsDaily,
    campaign_layer1: {
      campaigns_in_scope,
      distinct_campaigns_with_daily_rows,
      campaigns_missing_layer1_count,
      campaigns_missing_layer1_sample,
    },
    x_pipeline: {
      latest_x_last_tweets_sync_at,
      profiles_with_x_sync_count: profilesWithSyncRes.count ?? null,
      x_tweets_rows_created_last_24h: tweets24hRes.count ?? null,
      latest_x_tweet_row_created_at:
        (latestTweetCreatedRes.data as { created_at?: string } | null)?.created_at ?? null,
      x_daily_snapshots_latest_day: (latestSnapshotRes.data as { day?: string } | null)?.day ?? null,
      x_daily_snapshots_latest_created_at:
        (latestSnapshotRes.data as { created_at?: string } | null)?.created_at ?? null,
    },
    analytics_jobs: {
      queued: jobQueuedRes.count ?? null,
      running: jobRunningRes.count ?? null,
      failed_last_10: (failedJobsRes.data ?? []) as OpsLaunchDiagnostics["analytics_jobs"]["failed_last_10"],
      last_done_backfill_at:
        (lastDoneBackfillRes.data as { updated_at?: string } | null)?.updated_at ?? null,
    },
    env_flags,
    warnings,
  };
}
