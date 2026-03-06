import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** POST /api/xspaces/speaker-request/resolve — host approves or declines. Body: { request_id: string, status: "approved" | "declined" }.
 * Legacy "rejected" is accepted and mapped to "declined". Max 10 approved per space enforced via RPC on approve. */
export async function POST(request: NextRequest) {
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

  let body: { request_id?: string; status?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const requestId = typeof body.request_id === "string" ? body.request_id.trim() : null;
  const requestedStatus = body.status === "approved" ? "approved" : (body.status === "rejected" || body.status === "declined") ? "declined" : null;
  if (!requestId || !requestedStatus) {
    return NextResponse.json({ error: "request_id and status (approved|declined) required" }, { status: 400 });
  }

  const { data: sr, error: fetchErr } = await supabase
    .from("speaker_requests")
    .select("id, space_id, requester_profile_id")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchErr || !sr) return NextResponse.json({ error: "Speaker request not found" }, { status: 404 });
  const requesterId = (sr as { requester_profile_id?: string }).requester_profile_id;
  const spaceId = (sr as { space_id: string }).space_id;

  const { data: space } = await supabase
    .from("spaces")
    .select("host_profile_id")
    .eq("id", spaceId)
    .maybeSingle();
  if (!space || (space as { host_profile_id: string }).host_profile_id !== user.id) {
    return NextResponse.json({ error: "Only the space host can resolve speaker requests" }, { status: 403 });
  }

  if (requestedStatus === "approved") {
    const { data: rpcResult, error: rpcErr } = await supabase.rpc("approve_speaker_request", {
      p_request_id: requestId,
      p_host_profile_id: user.id,
    });
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });
    const result = rpcResult as { ok?: boolean; error?: string; approved_count?: number } | null;
    if (!result?.ok) {
      if (result?.error === "max_approved") {
        return NextResponse.json(
          { error: "Maximum approved speakers (10) reached for this space", code: "MAX_APPROVED", approved_count: result.approved_count ?? 10 },
          { status: 409 }
        );
      }
      if (result?.error === "forbidden") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (result?.error === "not_pending") return NextResponse.json({ error: "Request is not pending" }, { status: 400 });
      return NextResponse.json({ error: result?.error ?? "Approval failed" }, { status: 400 });
    }
    if (requesterId) {
      try {
        const { createNotification } = await import("@/lib/notifications");
        await createNotification(requesterId, "speaker_request_approved", { entity_type: "speaker_request", entity_id: requestId, payload: { space_id: spaceId } });
      } catch (_) { /* non-blocking */ }
    }
    const { data: updated } = await supabase
      .from("speaker_requests")
      .select("id, space_id, requester_profile_id, status, updated_at")
      .eq("id", requestId)
      .single();
    return NextResponse.json(updated ?? { id: requestId, status: "approved" });
  }

  const { data, error } = await supabase
    .from("speaker_requests")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("id", requestId)
    .select("id, space_id, requester_profile_id, status, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (requesterId) {
    try {
      const { createNotification } = await import("@/lib/notifications");
      await createNotification(requesterId, "speaker_request_rejected", { entity_type: "speaker_request", entity_id: requestId, payload: { space_id: spaceId } });
    } catch (_) { /* non-blocking */ }
  }
  return NextResponse.json(data);
}
