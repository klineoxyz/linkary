import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** POST /api/speaker-requests/[id]/respond — host approves or rejects */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = (await params).id;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: sr } = await supabase.from("speaker_requests").select("id, space_id, requester_profile_id").eq("id", requestId).maybeSingle();
  if (!sr) return NextResponse.json({ error: "Speaker request not found" }, { status: 404 });

  const { data: space } = await supabase.from("spaces").select("host_profile_id").eq("id", (sr as { space_id: string }).space_id).maybeSingle();
  if (!space || (space as { host_profile_id: string }).host_profile_id !== user.id) {
    return NextResponse.json({ error: "Only the host can respond" }, { status: 403 });
  }

  let body: { action?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* empty */
  }
  const action = body.action === "approve" ? "approved" : body.action === "reject" ? "declined" : null;
  if (!action) return NextResponse.json({ error: "action must be approve or reject" }, { status: 400 });

  if (action === "approved") {
    const { data: rpcResult, error: rpcErr } = await supabase.rpc("approve_speaker_request", {
      p_request_id: requestId,
      p_host_profile_id: user.id,
    });
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    const result = rpcResult as { ok?: boolean; error?: string } | null;
    if (!result?.ok) {
      if (result?.error === "max_approved") return NextResponse.json({ error: "Maximum approved speakers (10) reached", code: "MAX_APPROVED" }, { status: 409 });
      if (result?.error === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      return NextResponse.json({ error: result?.error ?? "Approval failed" }, { status: 400 });
    }
    const { data: updated } = await supabase.from("speaker_requests").select().eq("id", requestId).single();
    const requesterId = (sr as { requester_profile_id?: string }).requester_profile_id;
    if (requesterId) {
      try {
        const { createNotification } = await import("@/lib/notifications");
        await createNotification(requesterId, "speaker_request_approved", { entity_type: "speaker_request", entity_id: requestId, payload: { space_id: (sr as { space_id: string }).space_id } });
      } catch (_) { /* non-blocking */ }
    }
    return NextResponse.json(updated ?? { id: requestId, status: "approved" });
  }

  const { data, error } = await supabase
    .from("speaker_requests")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const requesterId = (sr as { requester_profile_id?: string }).requester_profile_id;
  if (requesterId) {
    try {
      const { createNotification } = await import("@/lib/notifications");
      await createNotification(requesterId, "speaker_request_rejected", { entity_type: "speaker_request", entity_id: requestId, payload: { space_id: (sr as { space_id: string }).space_id } });
    } catch (_) {
      /* non-blocking */
    }
  }
  return NextResponse.json(data);
}
