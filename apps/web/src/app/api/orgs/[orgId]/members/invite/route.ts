import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

/**
 * POST /api/orgs/[orgId]/members/invite
 * Owner/admin only. Body: { username?: string, email?: string }. Adds existing Linkary user as org admin.
 */
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
  if (!isAdmin) return NextResponse.json({ error: "Only org owner or admin can invite members" }, { status: 403 });

  let body: { username?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let targetUserId: string | null = null;
  if (body?.username && typeof body.username === "string") {
    const handle = body.username.trim().replace(/^@/, "").toLowerCase();
    if (handle) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", handle)
        .maybeSingle();
      if (profile) targetUserId = (profile as { id: string }).id;
    }
  }
  if (!targetUserId && body?.email && typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (email && serviceKey) {
      const service = createClient(supabaseUrl, serviceKey);
      const { data: profile } = await service
        .from("profiles")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      if (profile) targetUserId = (profile as { id: string }).id;
    }
  }

  if (!targetUserId) {
    return NextResponse.json({ error: "No Linkary user found for that username or email" }, { status: 404 });
  }

  const { error: insertErr } = await supabase.from("org_members").insert({
    org_id: orgId,
    user_id: targetUserId,
    role: "admin",
  });

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json({ error: "This user is already a member of the org" }, { status: 409 });
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
