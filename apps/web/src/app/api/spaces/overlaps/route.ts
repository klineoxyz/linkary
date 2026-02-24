import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const WINDOW_MINS = 60;

/** GET /api/spaces/overlaps?scheduled_at=ISO&duration_mins=N&exclude_space_id=...
 * Returns spaces that overlap with the given time window (±60 min collision).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const scheduledAt = searchParams.get("scheduled_at");
  const durationMins = parseInt(searchParams.get("duration_mins") ?? "60", 10) || 60;
  const excludeSpaceId = searchParams.get("exclude_space_id") ?? "";

  if (!scheduledAt || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ overlaps: [] });
  }

  const start = new Date(scheduledAt);
  if (isNaN(start.getTime())) return NextResponse.json({ overlaps: [] });
  const end = new Date(start.getTime() + durationMins * 60 * 1000);
  const windowStart = new Date(start.getTime() - WINDOW_MINS * 60 * 1000);
  const windowEnd = new Date(end.getTime() + WINDOW_MINS * 60 * 1000);

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  let q = supabase
    .from("spaces")
    .select("id, host_profile_id, title, scheduled_at, duration_mins, status")
    .in("status", ["scheduled", "live"])
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", windowStart.toISOString())
    .lte("scheduled_at", windowEnd.toISOString());
  if (excludeSpaceId) q = q.neq("id", excludeSpaceId);
  const { data: spaces } = await q;

  const overlaps = (spaces ?? []).map((s: { id: string; host_profile_id: string; title: string; scheduled_at: string; duration_mins: number | null; status: string }) => ({
    id: s.id,
    host_profile_id: s.host_profile_id,
    title: s.title,
    scheduled_at: s.scheduled_at,
    duration_mins: s.duration_mins,
    status: s.status,
  }));

  return NextResponse.json({ overlaps });
}
