/**
 * GET /api/connections/list
 * List connections for the current user: pending (incoming/outgoing) and accepted.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
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

  const { data: rows, error } = await supabase
    .from("connections")
    .select("id, requester_profile_id, recipient_profile_id, status, created_at, updated_at")
    .or(`requester_profile_id.eq.${user.id},recipient_profile_id.eq.${user.id}`)
    .in("status", ["pending", "accepted"])
    .order("updated_at", { ascending: false });

  if (error) return fail("INTERNAL", error.message, 500);

  const list = (rows ?? []).map((r: Record<string, unknown>) => {
    const otherId =
      r.requester_profile_id === user.id ? r.recipient_profile_id : r.requester_profile_id;
    const direction =
      r.requester_profile_id === user.id ? "outgoing" : "incoming";
    return {
      id: r.id,
      status: r.status,
      direction,
      other_profile_id: otherId,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  });
  return ok({ connections: list });
}
