/**
 * GET /api/reviews/check?collab_request_id=xxx
 * Returns whether the current user has already left a review for this collab request.
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
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const myProfileId = getProfileIdForAuthUser(user.id);
  const collabRequestId = request.nextUrl.searchParams.get("collab_request_id")?.trim() ?? "";
  if (!collabRequestId) return fail("BAD_REQUEST", "collab_request_id is required", 400);

  const { data: existing, error } = await supabase
    .from("collab_reviews")
    .select("id")
    .eq("collab_request_id", collabRequestId)
    .eq("reviewer_profile_id", myProfileId)
    .maybeSingle();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ has_reviewed: !!existing });
}
