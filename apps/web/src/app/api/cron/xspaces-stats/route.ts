/**
 * GET/POST /api/cron/xspaces-stats — placeholder worker for past space stats.
 * For spaces with x_space_id, attempt to fetch stats from provider and insert space_stats rows.
 * If provider cannot fetch stats, no-op and return 200. Call from cron (e.g. Vercel Cron) with CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  if (CRON_SECRET && request.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return run();
}

export async function POST(request: NextRequest) {
  if (CRON_SECRET && request.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return run();
}

async function run() {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ ok: false, reason: "Missing Supabase config" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: spaces } = await supabase
    .from("spaces")
    .select("id, x_space_id")
    .eq("status", "ended")
    .not("x_space_id", "is", null)
    .limit(50);

  const list = spaces ?? [];
  let processed = 0;
  for (const s of list) {
    const spaceId = (s as { id: string }).id;
    const xSpaceId = (s as { x_space_id: string | null }).x_space_id;
    if (!xSpaceId) continue;
    // Placeholder: no provider call yet. When available, fetch stats and insert:
    // await supabase.from("space_stats").insert({ space_id: spaceId, listeners_total, peak_listeners, duration_seconds, captured_at: new Date().toISOString() });
    processed += 1;
  }

  return NextResponse.json({
    ok: true,
    message: "Placeholder: stats fetch not implemented; system stable.",
    spaces_checked: list.length,
    processed,
  });
}
