/**
 * POST /api/collab-requests/mark-seen — set seen_at=now() for all target's new+unseen requests
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: "Bearer " + token } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const targetProfileId = getProfileIdForAuthUser(user.id);
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("collab_requests")
    .update({ seen_at: now })
    .eq("target_profile_id", targetProfileId)
    .eq("status", "new")
    .is("seen_at", null);

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok();
}
