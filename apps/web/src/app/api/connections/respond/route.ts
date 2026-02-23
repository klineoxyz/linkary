/**
 * POST /api/connections/respond
 * Accept or decline a connection request (recipient only). Accept requires recipient_followback_attested: true.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  let body: { connection_id?: string; action?: string; recipient_followback_attested?: boolean };
  try {
    body = await request.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }
  const connectionId = typeof body?.connection_id === "string" ? body.connection_id.trim() : "";
  const action = body?.action === "accept" || body?.action === "decline" ? body.action : null;
  const recipientFollowbackAttested = body?.recipient_followback_attested === true;
  if (!connectionId || !action) {
    return fail("BAD_REQUEST", "connection_id and action (accept|decline) are required", 400);
  }
  if (action === "accept" && !recipientFollowbackAttested) {
    return fail("BAD_REQUEST", "You must confirm you followed back on X (recipient_followback_attested: true) to accept", 400);
  }

  const { data: row, error: fetchErr } = await supabase
    .from("connections")
    .select("id, recipient_profile_id, status")
    .eq("id", connectionId)
    .single();
  if (fetchErr || !row) {
    return fail("NOT_FOUND", "Connection not found", 404);
  }
  const r = row as { id: string; recipient_profile_id: string; status: string };
  if (r.recipient_profile_id !== user.id) {
    return fail("FORBIDDEN", "Only the recipient can respond", 403);
  }
  if (r.status !== "pending") {
    return fail("CONFLICT", "Request is no longer pending", 409);
  }

  const { error: updateErr } = await supabase
    .from("connections")
    .update({
      status: action === "accept" ? "accepted" : "declined",
      recipient_followback_attested: action === "accept",
    })
    .eq("id", connectionId);

  if (updateErr) return fail("INTERNAL", updateErr.message, 500);
  return ok({ connection_id: connectionId, action });
}
