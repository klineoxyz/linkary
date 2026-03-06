/**
 * GET /api/xspaces/inbox — host inbox: pending sponsor proposals across spaces I host. Pending first.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const { data: mySpaces } = await supabase
    .from("spaces")
    .select("id, title, x_title, linkary_title")
    .eq("host_profile_id", user.id);
  const spaceIds = (mySpaces ?? []).map((s: { id: string }) => s.id);
  if (spaceIds.length === 0) {
    return NextResponse.json({ proposals: [], spaces: [] });
  }

  const { data: rows, error } = await supabase
    .from("space_sponsor_proposals")
    .select("id, space_id, project_profile_id, offer_amount, currency, sponsorship_type, message, status, created_at")
    .in("space_id", spaceIds)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const proposals = (rows ?? []) as Array<{
    id: string;
    space_id: string;
    project_profile_id: string;
    offer_amount: number;
    currency: string;
    sponsorship_type: string;
    message: string | null;
    status: string;
    created_at: string;
  }>;

  const spaceById = new Map((mySpaces ?? []).map((s: { id: string; title?: string; x_title?: string | null; linkary_title?: string | null }) => [
    s.id,
    { id: s.id, title: (s.linkary_title?.trim() || s.x_title?.trim() || s.title) || "Space" },
  ]));
  const profileIds = [...new Set(proposals.map((p) => p.project_profile_id))];
  const { data: profiles } = await supabase.from("profiles").select("id, username, display_name").in("id", profileIds);
  const profileById = new Map((profiles ?? []).map((p: { id: string; username: string | null; display_name: string | null }) => [p.id, p]));

  const enriched = proposals.map((p) => {
    const space = spaceById.get(p.space_id);
    const profile = profileById.get(p.project_profile_id);
    return {
      ...p,
      space_title: space?.title ?? null,
      project_display_name: profile?.display_name ?? null,
      project_username: profile?.username ?? null,
    };
  });

  const pendingFirst = [...enriched].sort((a, b) => (a.status === "pending" && b.status !== "pending" ? -1 : a.status !== "pending" && b.status === "pending" ? 1 : 0));

  return NextResponse.json({ proposals: pendingFirst, spaces: mySpaces ?? [] });
}
