import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** GET: List org members (RLS). Optionally with profile info (username, display_name, avatar_url). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { orgId } = await params;
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: members, error: membersErr } = await supabase
    .from("org_members")
    .select("id, org_id, user_id, role, created_at")
    .eq("org_id", orgId)
    .order("role");

  if (membersErr) return NextResponse.json({ error: membersErr.message }, { status: 500 });
  const list = (members ?? []) as { id: string; org_id: string; user_id: string; role: string; created_at: string }[];
  if (list.length === 0) return NextResponse.json({ members: [] });

  const userIds = [...new Set(list.map((m) => m.user_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", userIds);
  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; username: string | null; display_name: string | null; avatar_url: string | null }) => [
      p.id,
      { username: p.username ?? null, display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null },
    ])
  );

  const membersWithProfile = list.map((m) => ({
    ...m,
    profile: profileMap.get(m.user_id) ?? null,
  }));

  return NextResponse.json({ members: membersWithProfile });
}

/** POST: Add member. Body: { username?: string, userId?: string, role: 'member' | 'admin' | 'owner' }. Caller must be org admin. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { orgId } = await params;
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { p_org_id: orgId, p_uid: user.id });
  if (!isAdmin) return NextResponse.json({ error: "Only org owner or admin can add members" }, { status: 403 });

  let body: { username?: string; userId?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const role = body?.role === "owner" || body?.role === "admin" || body?.role === "member" ? body.role : "member";
  let targetUserId: string | null = null;
  if (body?.userId && typeof body.userId === "string") {
    targetUserId = body.userId.trim();
  } else if (body?.username && typeof body.username === "string") {
    const handle = body.username.trim().replace(/^@/, "").toLowerCase();
    if (!handle) return NextResponse.json({ error: "username or userId required" }, { status: 400 });
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", handle)
      .maybeSingle();
    if (!profile) return NextResponse.json({ error: "Profile not found for that username" }, { status: 404 });
    targetUserId = (profile as { id: string }).id;
  } else {
    return NextResponse.json({ error: "username or userId required" }, { status: 400 });
  }

  const { error: insertErr } = await supabase.from("org_members").insert({
    org_id: orgId,
    user_id: targetUserId,
    role,
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json({ error: "This user is already a member of the org" }, { status: 409 });
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
