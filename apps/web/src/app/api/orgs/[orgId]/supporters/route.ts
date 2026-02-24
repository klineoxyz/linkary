import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** GET /api/orgs/[orgId]/supporters?limit=12
 * Returns supporter count + sample list (profile id, avatar, display_name). Public read.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const orgId = (await params).orgId;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "12", 10) || 12));

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ count: 0, supporters: [] }, { status: 200 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { count, error: countErr } = await supabase
    .from("org_supporters")
    .select("profile_id", { count: "exact", head: true })
    .eq("org_id", orgId);
  const total = countErr ? 0 : (count ?? 0);

  const { data: rows } = await supabase
    .from("org_supporters")
    .select("profile_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const profileIds = (rows ?? []).map((r: { profile_id: string }) => r.profile_id);
  if (profileIds.length === 0) {
    return NextResponse.json({ count: total, supporters: [] });
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, username")
    .in("id", profileIds);

  const byId = new Map((profiles ?? []).map((p: { id: string; display_name: string | null; avatar_url: string | null; username: string | null }) => [p.id, p]));
  const supporters = profileIds.map((id) => {
    const p = byId.get(id);
    return {
      id,
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
      username: p?.username ?? null,
    };
  });

  return NextResponse.json({ count: total, supporters });
}
