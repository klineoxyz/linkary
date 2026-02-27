/**
 * GET /api/reviews/by-profile/[username]
 * Returns latest collab reviews for the profile (target). Public; no auth.
 * Resolves username via public_profile_view. Includes reviewer display_name, avatar_url, verified: true.
 */
import { NextRequest } from "next/server";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { normalizeIdentifier } from "@/lib/entityResolver";
import { ok, fail } from "@/lib/api-response";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const username = (await params).username?.trim();
  const segmentLower = normalizeIdentifier(username ?? "");
  if (!segmentLower) return fail("BAD_REQUEST", "Invalid username", 400);

  let serviceSupabase;
  try {
    serviceSupabase = createServiceSupabase();
  } catch {
    return fail("SERVICE_UNAVAILABLE", "Service unavailable", 503);
  }

  const { data: profile } = await serviceSupabase
    .from("public_profile_view")
    .select("id")
    .or(`username.ilike.${segmentLower},twitter_username.ilike.${segmentLower}`)
    .maybeSingle();

  if (!profile) return fail("NOT_FOUND", "Profile not found", 404);
  const profileId = (profile as { id: string }).id;

  const { data: rows, error } = await serviceSupabase
    .from("collab_reviews")
    .select("id, reviewer_profile_id, rating, text, created_at")
    .eq("target_profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return fail("DB_ERROR", error.message, 500);

  const list = (rows ?? []) as Array<{ id: string; reviewer_profile_id: string; rating: number; text: string; created_at: string }>;
  const reviewerIds = [...new Set(list.map((r) => r.reviewer_profile_id))];
  let reviewerById: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
  if (reviewerIds.length > 0) {
    const { data: profs } = await serviceSupabase
      .from("public_profile_view")
      .select("id, display_name, avatar_url")
      .in("id", reviewerIds);
    for (const p of (profs ?? []) as Array<{ id: string; display_name: string | null; avatar_url: string | null }>) {
      reviewerById[p.id] = { display_name: p.display_name, avatar_url: p.avatar_url };
    }
  }

  const reviews = list.map((r) => {
    const reviewer = reviewerById[r.reviewer_profile_id];
    return {
      id: r.id,
      rating: r.rating,
      text: r.text,
      created_at: r.created_at,
      reviewer_display: reviewer?.display_name ?? "Anonymous",
      reviewer_avatar_url: reviewer?.avatar_url ?? null,
      verified: true,
    };
  });

  return ok({ reviews });
}
