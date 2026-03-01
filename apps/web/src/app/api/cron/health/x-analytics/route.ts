/**
 * GET /api/cron/health/x-analytics
 * Service-only: returns X analytics pipeline health (last ingestion, last rollup, counts).
 * Auth: CRON_SECRET (x-cron-secret or Bearer). Used by ops to verify cron/worker freshness.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: NextRequest) {
  const secret =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || secret !== cronSecret) {
    return unauthorized();
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Service not configured", scheduler_present: !!process.env.CRON_SECRET },
      { status: 503 }
    );
  }

  const service = createClient(supabaseUrl, supabaseServiceKey);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const [
      { data: lastSyncRow },
      { data: lastDoneRow },
      { data: lastFailedRow },
      { count: tweetsLast24h },
      { data: rollupLast24hRows },
      { data: latestRollupRow },
    ] = await Promise.all([
      service
        .from("profiles")
        .select("x_last_tweets_sync_at")
        .not("x_last_tweets_sync_at", "is", null)
        .order("x_last_tweets_sync_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      service
        .from("analytics_jobs")
        .select("updated_at")
        .eq("job_type", "x_backfill_90d")
        .eq("status", "done")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      service
        .from("analytics_jobs")
        .select("updated_at, last_error")
        .eq("job_type", "x_backfill_90d")
        .not("last_error", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      service
        .from("x_tweets")
        .select("id", { count: "exact", head: true })
        .gte("created_at", twentyFourHoursAgo),
      service
        .from("x_window_aggregates")
        .select("owner_id, updated_at")
        .eq("owner_type", "profile")
        .gte("updated_at", twentyFourHoursAgo),
      service
        .from("x_window_aggregates")
        .select("updated_at")
        .eq("owner_type", "profile")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const last_ingestion_run_at =
      (lastSyncRow as { x_last_tweets_sync_at?: string } | null)?.x_last_tweets_sync_at ?? null;
    const last_rollup_run_at =
      (latestRollupRow as { updated_at?: string } | null)?.updated_at ?? null;

    const last_success_at = (lastDoneRow as { updated_at?: string } | null)?.updated_at ?? null;
    const last_failed_row = lastFailedRow as { updated_at?: string; last_error?: string | null } | null;
    const last_error_at = last_failed_row?.updated_at ?? null;
    const last_error_message = last_failed_row?.last_error ?? null;

    const updated_rollups_last_24h_profiles =
      rollupLast24hRows && Array.isArray(rollupLast24hRows)
        ? new Set((rollupLast24hRows as { owner_id: string }[]).map((r) => r.owner_id)).size
        : 0;

    return NextResponse.json({
      ok: true,
      scheduler_present: !!process.env.CRON_SECRET,
      last_ingestion_run_at,
      last_rollup_run_at,
      last_success_at,
      last_error_at,
      last_error_message: last_error_message ?? undefined,
      counts: {
        ingested_last_24h_tweets: tweetsLast24h ?? 0,
        updated_rollups_last_24h_profiles,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        error: message,
        scheduler_present: !!process.env.CRON_SECRET,
      },
      { status: 500 }
    );
  }
}
