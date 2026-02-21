import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runBackfillX90d } from "@/lib/backfill-x-90d";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
const BATCH_SIZE = 20;

/** Cron: backfill 90 days of X analytics for a small batch of profiles. Protected by CRON_SECRET. */
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
    const result = await runBackfillX90d(service, { limit: BATCH_SIZE, dryRun: false });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Backfill failed";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
