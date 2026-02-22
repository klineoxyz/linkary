import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enqueueXBackfill90dJobs } from "@/lib/backfill-x-90d";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
const BATCH_SIZE = 20;

/** Cron: enqueue x_backfill_90d jobs only (no snapshot writes). Worker builds real 90d via x_daily_snapshots + x_window_aggregates. Protected by CRON_SECRET. */
export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!supabaseServiceKey) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const service = createClient(supabaseUrl, supabaseServiceKey);
  try {
    const result = await enqueueXBackfill90dJobs(service, { limit: BATCH_SIZE, dryRun: false });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Enqueue failed";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
