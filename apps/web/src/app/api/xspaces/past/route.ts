import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const SPACE_COLS = "id, host_profile_id, title, description, scheduled_at, duration_mins, status, created_at, x_space_id, x_space_url, expect_x_link";

/** GET /api/xspaces/past — ended spaces with optional stats, ordered by scheduled_at desc */
export async function GET() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ spaces: [], statsBySpaceId: {} });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: spaces, error: spacesError } = await supabase
    .from("spaces")
    .select(SPACE_COLS)
    .eq("status", "ended")
    .order("scheduled_at", { ascending: false })
    .limit(100);

  if (spacesError) return NextResponse.json({ spaces: [], statsBySpaceId: {}, error: spacesError.message }, { status: 500 });

  const spaceList = spaces ?? [];
  const hostIds = [...new Set(spaceList.map((s: { host_profile_id: string }) => s.host_profile_id).filter(Boolean))];
  if (hostIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, display_name, twitter_username, avatar_url").in("id", hostIds);
    const hostById = new Map((profiles ?? []).map((p: { id: string; display_name: string | null; twitter_username: string | null; avatar_url: string | null }) => [
      p.id,
      { id: p.id, display_name: p.display_name ?? null, twitter_username: p.twitter_username ?? null, profile_image_url: p.avatar_url ?? null },
    ]));
    for (const s of spaceList) {
      const h = hostById.get(s.host_profile_id);
      if (h) (s as typeof s & { host?: unknown }).host = h;
    }
  }

  const ids = spaceList.map((s) => s.id);
  const statsBySpaceId: Record<string, { listeners_total?: number; peak_listeners?: number; duration_seconds?: number }> = {};
  if (ids.length > 0) {
    const { data: stats } = await supabase
      .from("space_stats")
      .select("space_id, listeners_total, peak_listeners, duration_seconds")
      .in("space_id", ids)
      .order("captured_at", { ascending: false });
    for (const row of stats ?? []) {
      const sid = (row as { space_id: string }).space_id;
      if (!statsBySpaceId[sid]) statsBySpaceId[sid] = {};
      const cur = statsBySpaceId[sid];
      if (cur.listeners_total == null) cur.listeners_total = (row as { listeners_total?: number }).listeners_total ?? null;
      if (cur.peak_listeners == null) cur.peak_listeners = (row as { peak_listeners?: number }).peak_listeners ?? null;
      if (cur.duration_seconds == null) cur.duration_seconds = (row as { duration_seconds?: number }).duration_seconds ?? null;
    }
  }
  return NextResponse.json({ spaces: spaceList, statsBySpaceId });
}
