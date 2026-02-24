import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** POST: Org admin marks deal as accepted (completes deal when delivered_at already set). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: deal, error: fetchErr } = await supabase
    .from("deals")
    .select("id, org_id, delivered_at, accepted_at")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", deal.org_id)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes((membership as { role: string }).role)) {
    return NextResponse.json({ error: "Only org owner or admin can accept the deal" }, { status: 403 });
  }
  if (!deal.delivered_at) {
    return NextResponse.json({ error: "Creator must mark work delivered first" }, { status: 400 });
  }
  if (deal.accepted_at) {
    return NextResponse.json({ error: "Already accepted" }, { status: 400 });
  }

  const { error: updateErr } = await supabase
    .from("deals")
    .update({
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  try {
    const { data: dealRow } = await supabase.from("deals").select("profile_id, org_id, status, completed_at").eq("id", id).single();
    const row = dealRow as { profile_id?: string; org_id?: string; status?: string; completed_at?: string | null } | null;
    const creatorId = row?.profile_id;
    const orgId = row?.org_id;
    const isCompleted = row?.status === "completed" || row?.completed_at != null;
    const { createNotification } = await import("@/lib/notifications");
    if (creatorId) {
      await createNotification(creatorId, "deal_accepted", { entity_type: "deal", entity_id: id });
      if (isCompleted) await createNotification(creatorId, "deal_completed", { entity_type: "deal", entity_id: id });
    }
    if (orgId && isCompleted) {
      const { data: orgAdmins } = await supabase.from("org_members").select("user_id").eq("org_id", orgId).in("role", ["owner", "admin"]);
      for (const m of orgAdmins ?? []) {
        const uid = (m as { user_id: string }).user_id;
        if (uid) await createNotification(uid, "deal_completed", { entity_type: "deal", entity_id: id });
      }
    }
  } catch (_) {
    /* non-blocking */
  }
  return NextResponse.json({ ok: true, accepted_at: new Date().toISOString() });
}
