/**
 * GET /api/collab-requests/count — inboxNew (new + unseen) and sentTotal for nav badge
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: "Bearer " + token } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const profileId = getProfileIdForAuthUser(user.id);

  const inboxRes = await supabase.from("collab_requests").select("id", { count: "exact", head: true }).eq("target_profile_id", profileId).eq("status", "new").is("seen_at", null);
  const sentRes = await supabase.from("collab_requests").select("id", { count: "exact", head: true }).eq("requester_profile_id", profileId);

  const inboxNew = typeof inboxRes.count === "number" ? inboxRes.count : 0;
  const sentTotal = typeof sentRes.count === "number" ? sentRes.count : 0;

  return ok({ inboxNew, sentTotal });
}
