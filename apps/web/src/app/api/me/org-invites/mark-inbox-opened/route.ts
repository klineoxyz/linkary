/**
 * POST /api/me/org-invites/mark-inbox-opened — creator opened Org invites page; mark all as inbox-seen.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
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
  const now = new Date().toISOString();

  await supabase
    .from("org_job_invites")
    .update({ viewed_at: now })
    .eq("profile_id", pid)
    .is("viewed_at", null);

  await supabase
    .from("creator_program_invites")
    .update({ invitee_inbox_seen_at: now })
    .eq("profile_id", pid)
    .is("invitee_inbox_seen_at", null);

  return NextResponse.json({ ok: true });
}
