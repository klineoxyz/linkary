import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** DELETE: Remove member (self or org admin). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  const authHeader = _request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { orgId, userId: targetUserId } = await params;
  if (!orgId || !targetUserId) {
    return NextResponse.json({ error: "orgId and userId required" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { p_org_id: orgId, p_uid: user.id });
  const isSelf = user.id === targetUserId;
  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: "Only org admin can remove others; you can leave yourself" }, { status: 403 });
  }

  const { error: deleteErr } = await supabase
    .from("org_members")
    .delete()
    .eq("org_id", orgId)
    .eq("user_id", targetUserId);

  if (deleteErr) {
    if (deleteErr.message?.includes("at least one owner")) {
      return NextResponse.json({ error: "Organization must have at least one owner" }, { status: 400 });
    }
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** PATCH: Update member role. Body: { role: 'member' | 'admin' | 'owner' }. Caller must be org admin. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { orgId, userId: targetUserId } = await params;
  if (!orgId || !targetUserId) {
    return NextResponse.json({ error: "orgId and userId required" }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { p_org_id: orgId, p_uid: user.id });
  if (!isAdmin) return NextResponse.json({ error: "Only org owner or admin can change roles" }, { status: 403 });

  let body: { role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const role = body?.role === "owner" || body?.role === "admin" || body?.role === "member" ? body.role : null;
  if (!role) return NextResponse.json({ error: "role must be owner, admin, or member" }, { status: 400 });

  const { error: updateErr } = await supabase
    .from("org_members")
    .update({ role })
    .eq("org_id", orgId)
    .eq("user_id", targetUserId);

  if (updateErr) {
    if (updateErr.message?.includes("at least one owner")) {
      return NextResponse.json({ error: "Organization must have at least one owner" }, { status: 400 });
    }
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
