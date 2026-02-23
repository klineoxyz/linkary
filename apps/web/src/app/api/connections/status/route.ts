/**
 * GET /api/connections/status?username=xxx
 * Returns connection state between current user and the profile identified by username.
 * Used by public profile page to show Connect / Requested / Accept|Decline / Message.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/^@/, "");
}

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

  const { searchParams } = new URL(request.url);
  const username = norm(searchParams.get("username") ?? "");
  if (!username) {
    return fail("BAD_REQUEST", "username is required", 400);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  if (!profile) {
    return ok({ status: "none" });
  }
  const otherId = (profile as { id: string }).id;
  if (otherId === user.id) {
    return ok({ status: "self" });
  }

  const { data: outbound } = await supabase
    .from("connections")
    .select("id, status")
    .eq("requester_profile_id", user.id)
    .eq("recipient_profile_id", otherId)
    .maybeSingle();
  const { data: inbound } = await supabase
    .from("connections")
    .select("id, status")
    .eq("requester_profile_id", otherId)
    .eq("recipient_profile_id", user.id)
    .maybeSingle();

  if (outbound) {
    const r = outbound as { id: string; status: string };
    if (r.status === "accepted") return ok({ status: "accepted", connection_id: r.id });
    if (r.status === "pending") return ok({ status: "pending_outgoing", connection_id: r.id });
  }
  if (inbound) {
    const r = inbound as { id: string; status: string };
    if (r.status === "accepted") return ok({ status: "accepted", connection_id: r.id });
    if (r.status === "pending") return ok({ status: "pending_incoming", connection_id: r.id });
  }
  return ok({ status: "none" });
}
