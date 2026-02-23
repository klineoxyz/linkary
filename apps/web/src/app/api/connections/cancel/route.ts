/**
 * POST /api/connections/cancel
 * Cancel a pending connection request (requester only). Sets status to declined.
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

  let body: { connection_id?: string };
  try {
    body = await request.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }
  const connectionId = typeof body?.connection_id === "string" ? body.connection_id.trim() : "";
  if (!connectionId) {
    return fail("BAD_REQUEST", "connection_id is required", 400);
  }

  const { data: row, error: fetchErr } = await supabase
    .from("connections")
    .select("id, requester_profile_id, status")
    .eq("id", connectionId)
    .single();
  if (fetchErr || !row) {
    return fail("NOT_FOUND", "Connection not found", 404);
  }
  const r = row as { id: string; requester_profile_id: string; status: string };
  if (r.requester_profile_id !== user.id) {
    return fail("FORBIDDEN", "Only the requester can cancel", 403);
  }
  if (r.status !== "pending") {
    return fail("CONFLICT", "Request is no longer pending", 409);
  }

  const { error: updateErr } = await supabase
    .from("connections")
    .update({ status: "declined" })
    .eq("id", connectionId);

  if (updateErr) return fail("INTERNAL", updateErr.message, 500);
  return ok({ connection_id: connectionId, cancelled: true });
}
