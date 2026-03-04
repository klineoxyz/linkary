import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const SPACE_COLS = "id, host_profile_id, title, description, scheduled_at, duration_mins, status, created_at, x_space_id, x_space_url";

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
  const { data, error } = await supabase
    .from("spaces")
    .select(SPACE_COLS)
    .in("status", ["planned", "scheduled", "live"])
    .or(`scheduled_at.gte."${now}",status.eq.live`)
    .order("scheduled_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ spaces: [], error: error.message }, { status: 500 });
  return NextResponse.json({ spaces: data ?? [] });
}
