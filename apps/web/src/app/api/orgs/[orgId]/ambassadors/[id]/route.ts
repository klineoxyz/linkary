import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

/** PATCH: Set ambassador status (active = accept invite, removed). Notifies org admins on accept; notifies profile + org admins on remove. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; id: string }> }
) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, id: ambassadorId } = await params;
  if (!orgId || !ambassadorId) return NextResponse.json({ error: "orgId and id required" }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: row, error: fetchErr } = await supabase
    .from("org_ambassadors")
    .select("id, org_id, profile_id, status")
    .eq("id", ambassadorId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: "Ambassador record not found" }, { status: 404 });
  }

  const profileId = (row as { profile_id: string }).profile_id;

  let body: { status?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const newStatus = body?.status;
  if (newStatus !== "active" && newStatus !== "removed") {
    return NextResponse.json({ error: "status must be active or removed" }, { status: 400 });
  }

  const currentStatus = (row as { status: string }).status;
  if (newStatus === "active") {
    if (currentStatus !== "invited") return NextResponse.json({ error: "Only invited ambassadors can be accepted" }, { status: 400 });
    if (profileId !== user.id) return NextResponse.json({ error: "Only the invited profile can accept" }, { status: 403 });
  } else {
    if (currentStatus === "removed") return NextResponse.json({ error: "Already removed" }, { status: 400 });
    const { data: isAdmin } = await supabase.rpc("is_org_admin", { p_org_id: orgId, p_uid: user.id });
    if (!isAdmin && profileId !== user.id) {
      return NextResponse.json({ error: "Only org admin or the ambassador can remove" }, { status: 403 });
    }
  }

  const { error: updateErr } = await supabase
    .from("org_ambassadors")
    .update({ status: newStatus })
    .eq("id", ambassadorId)
    .eq("org_id", orgId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  if (!serviceKey) return NextResponse.json({ ok: true });

  try {
    const { createNotification } = await import("@/lib/notifications");
    const service = createClient(supabaseUrl, serviceKey);
    const { data: orgAdmins } = await service.from("org_members").select("user_id").eq("org_id", orgId).in("role", ["owner", "admin"]);

    if (newStatus === "active") {
      for (const m of orgAdmins ?? []) {
        const uid = (m as { user_id: string }).user_id;
        if (uid) await createNotification(uid, "ambassador_invite_accepted", { entity_type: "org_ambassador", entity_id: ambassadorId, payload: { org_id: orgId, profile_id: profileId } });
      }
    } else {
      if (profileId) await createNotification(profileId, "ambassador_removed", { entity_type: "org_ambassador", entity_id: ambassadorId, payload: { org_id: orgId } });
      for (const m of orgAdmins ?? []) {
        const uid = (m as { user_id: string }).user_id;
        if (uid) await createNotification(uid, "ambassador_removed", { entity_type: "org_ambassador", entity_id: ambassadorId, payload: { org_id: orgId, profile_id: profileId } });
      }
    }
  } catch (_) {
    /* non-blocking */
  }
  return NextResponse.json({ ok: true });
}
