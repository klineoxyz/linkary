import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const SPACE_COLS = "id, host_profile_id, title, x_title, linkary_title, description, scheduled_at, duration_mins, status, created_at, x_space_id, x_space_url, expect_x_link";

/** GET /api/xspaces/upcoming — upcoming + live spaces.
 * Include: status in (planned, scheduled, live) AND (scheduled_at >= now OR status = 'live') so live spaces are not hidden.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ spaces: [] });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {});

  const now = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("spaces")
    .select(SPACE_COLS)
    .in("status", ["planned", "scheduled", "live"])
    .or(`scheduled_at.gte."${now}",status.eq.live`)
    .order("scheduled_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ spaces: [], error: error.message }, { status: 500 });
  const spaces = (rows ?? []) as Array<{ id: string; host_profile_id: string; title: string; x_title?: string | null; linkary_title?: string | null; description: string | null; scheduled_at: string | null; duration_mins: number | null; status: string; created_at: string; x_space_id?: string | null; x_space_url?: string | null; expect_x_link?: boolean }>;
  const hostIds = [...new Set(spaces.map((s) => s.host_profile_id).filter(Boolean))];
  if (hostIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, display_name, twitter_username, avatar_url").in("id", hostIds);
    const hostById = new Map((profiles ?? []).map((p: { id: string; display_name: string | null; twitter_username: string | null; avatar_url: string | null }) => [
      p.id,
      { id: p.id, display_name: p.display_name ?? null, twitter_username: p.twitter_username ?? null, profile_image_url: p.avatar_url ?? null },
    ]));
    for (const s of spaces) {
      const h = hostById.get(s.host_profile_id);
      if (h) (s as typeof s & { host?: unknown }).host = h;
    }
  }
  return NextResponse.json({ spaces });
}
