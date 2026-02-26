/**
 * GET /api/reviews/mine — reviews I wrote (reviewer_profile_id = auth.uid()).
 * Returns: id, rating, title, body, created_at, verified_deal, gig_deal_id, reviewee_profile_id
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(_request: NextRequest) {
  const authHeader = _request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const myProfileId = getProfileIdForAuthUser(user.id);

  const { data: rows, error } = await supabase
    .from("reviews")
    .select("id, rating, title, body, created_at, verified_deal, gig_deal_id, reviewee_profile_id")
    .eq("reviewer_type", "profile")
    .eq("reviewer_profile_id", myProfileId)
    .order("created_at", { ascending: false });

  if (error) return fail("DB_ERROR", error.message, 500);

  const reviews = (rows ?? []) as Array<{
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    created_at: string;
    verified_deal: boolean;
    gig_deal_id: string | null;
    reviewee_profile_id: string | null;
  }>;

  return ok({ reviews });
}
