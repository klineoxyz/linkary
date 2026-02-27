/**
 * POST /api/reviews/create
 * Create a verified review for a collab request (status must be done).
 * Body: { collab_request_id, rating, text }
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const TEXT_MAX = 1000;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const myProfileId = getProfileIdForAuthUser(user.id);

  let body: { collab_request_id?: string; rating?: number; text?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const collabRequestId = typeof body?.collab_request_id === "string" ? body.collab_request_id.trim() : "";
  if (!collabRequestId) return fail("BAD_REQUEST", "collab_request_id is required", 400);

  const rating = typeof body?.rating === "number" ? body.rating : Number(body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail("BAD_REQUEST", "rating must be 1–5", 400);

  const textRaw = typeof body?.text === "string" ? body.text.trim() : "";
  if (!textRaw) return fail("BAD_REQUEST", "text is required", 400);
  const text = textRaw.length > TEXT_MAX ? textRaw.slice(0, TEXT_MAX) : textRaw;

  const { data: cr, error: crError } = await supabase
    .from("collab_requests")
    .select("id, requester_profile_id, target_profile_id, status")
    .eq("id", collabRequestId)
    .maybeSingle();

  if (crError) return fail("DB_ERROR", crError.message, 500);
  if (!cr) return fail("NOT_FOUND", "Request not found", 404);

  const row = cr as { id: string; requester_profile_id: string; target_profile_id: string; status: string };
  if (row.status !== "done") return fail("BAD_REQUEST", "Can only review when request is done", 400);

  const isRequester = row.requester_profile_id === myProfileId;
  const isTarget = row.target_profile_id === myProfileId;
  if (!isRequester && !isTarget) return fail("FORBIDDEN", "You can only review your own collabs", 403);

  const targetProfileId = isRequester ? row.target_profile_id : row.requester_profile_id;
  if (targetProfileId === myProfileId) return fail("BAD_REQUEST", "Cannot review yourself", 400);

  const { data: inserted, error: insertError } = await supabase
    .from("collab_reviews")
    .insert({
      collab_request_id: collabRequestId,
      reviewer_profile_id: myProfileId,
      target_profile_id: targetProfileId,
      rating,
      text,
      updated_at: new Date().toISOString(),
    })
    .select("id, collab_request_id, reviewer_profile_id, target_profile_id, rating, text, created_at")
    .single();

  if (insertError) {
    if (insertError.code === "23505") return fail("CONFLICT", "You already left a review for this collab", 409);
    return fail("DB_ERROR", insertError.message, 500);
  }

  try {
    const { createServiceSupabase } = await import("@/lib/x-analytics-server");
    const serviceSupabase = createServiceSupabase();
    const { recomputeRepForProfiles } = await import("@/lib/repScore");
    await recomputeRepForProfiles([myProfileId, targetProfileId], serviceSupabase);
  } catch {
    /* non-fatal */
  }

  return ok(
    (inserted as { id: string; collab_request_id: string; reviewer_profile_id: string; target_profile_id: string; rating: number; text: string; created_at: string }) as unknown as Record<string, unknown>,
    { status: 201 }
  );
}
