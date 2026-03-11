/**
 * GET /api/me/access — for invite-only gate. Returns { allowed: boolean, reason?: string }.
 * When platform is invite-only: allowed = true if profile has inviter_id set (already redeemed) or is admin; else allowed = false, reason = 'invite_required'.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const INVITE_ONLY = process.env.LINKARY_INVITE_ONLY === "true";
const ADMIN_TWITTER_HANDLE = "muazxinthi";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ allowed: false, reason: "unauthorized" }, { status: 401 });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ allowed: false, reason: "invalid_session" }, { status: 401 });
  }

  if (!INVITE_ONLY) {
    return NextResponse.json({ allowed: true });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, inviter_id, twitter_username")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) {
    return NextResponse.json({ allowed: false, reason: "invite_required" });
  }
  const inviterId = (profile as { inviter_id?: string | null }).inviter_id;
  const twitter = ((profile as { twitter_username?: string | null }).twitter_username ?? "").replace(/^@/, "").toLowerCase();
  if (inviterId != null && inviterId !== "") {
    return NextResponse.json({ allowed: true });
  }
  if (twitter === ADMIN_TWITTER_HANDLE) {
    return NextResponse.json({ allowed: true });
  }
  // Allow admin by auth identity when profile.twitter_username not yet synced (e.g. ensure-social-x runs after this)
  const fromMeta = (user.user_metadata?.user_name ?? user.user_metadata?.preferred_username ?? "").toString().replace(/^@/, "").toLowerCase();
  if (fromMeta === ADMIN_TWITTER_HANDLE) {
    return NextResponse.json({ allowed: true });
  }
  return NextResponse.json({ allowed: false, reason: "invite_required" });
}
