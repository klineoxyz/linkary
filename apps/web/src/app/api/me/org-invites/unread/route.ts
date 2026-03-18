/**
 * GET /api/me/org-invites/unread — counts invites not yet "seen" in inbox (grounded in stored timestamps).
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
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  const pid = user.id;

  const { count: jobUnread } = await supabase
    .from("org_job_invites")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", pid)
    .is("viewed_at", null);

  const { count: progUnread } = await supabase
    .from("creator_program_invites")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", pid)
    .is("invitee_inbox_seen_at", null);

  const j = jobUnread ?? 0;
  const p = progUnread ?? 0;
  return NextResponse.json({
    job: j,
    program: p,
    total: j + p,
  });
}
