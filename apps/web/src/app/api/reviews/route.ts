import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST: Create a review.
 * v1: Only verified_deal = true allowed. Body: { reviewee_profile_id, rating (1-5), body?, title?, verified_deal: true }
 * Requires an active or completed gig_deal between reviewer and reviewee.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let body: { reviewee_profile_id?: string; deal_id?: string; rating?: number; body?: string; title?: string; verified_deal?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rating = typeof body.rating === "number" ? body.rating : Number(body.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating must be 1–5" }, { status: 400 });
  }

  // v1: only allow verified reviews (gig-deal gated)
  if (body.verified_deal !== true) {
    return NextResponse.json(
      { error: "Only verified reviews are allowed right now. Verified review requires a deal." },
      { status: 400 }
    );
  }

  const revieweeProfileId = typeof body.reviewee_profile_id === "string" ? body.reviewee_profile_id.trim() : null;
  if (!revieweeProfileId) {
    return NextResponse.json({ error: "reviewee_profile_id is required for verified reviews" }, { status: 400 });
  }

  const reviewerProfileId = getProfileIdForAuthUser(user.id);
  if (revieweeProfileId === reviewerProfileId) {
    return NextResponse.json({ error: "Self-review is not allowed" }, { status: 400 });
  }

  // Require an active or completed gig_deal between reviewer and reviewee (either direction)
  const { data: gigDeal, error: dealErr } = await supabase
    .from("gig_deals")
    .select("id, status")
    .or(
      `and(owner_profile_id.eq.${reviewerProfileId},participant_profile_id.eq.${revieweeProfileId}),and(owner_profile_id.eq.${revieweeProfileId},participant_profile_id.eq.${reviewerProfileId})`
    )
    .in("status", ["active", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (dealErr || !gigDeal) {
    return NextResponse.json(
      { error: "Verified review requires a deal" },
      { status: 403 }
    );
  }

  const { data: review, error: insertErr } = await supabase
    .from("reviews")
    .insert({
      gig_deal_id: (gigDeal as { id: string }).id,
      reviewer_type: "profile",
      reviewer_profile_id: reviewerProfileId,
      reviewer_org_id: null,
      reviewee_type: "profile",
      reviewee_profile_id: revieweeProfileId,
      reviewee_org_id: null,
      rating: Math.round(rating),
      body: typeof body.body === "string" ? body.body.trim() || null : null,
      title: typeof body.title === "string" ? body.title.trim() || null : null,
      verified_deal: true,
    })
    .select("id, gig_deal_id, rating, body, title, created_at")
    .single();

  if (insertErr) {
    const msg = insertErr.message ?? "";
    if (msg.includes("Verified review requires") || msg.includes("deal")) {
      return NextResponse.json({ error: "Verified review requires a deal" }, { status: 403 });
    }
    if (msg.includes("Self-review") || msg.includes("self_review")) {
      return NextResponse.json({ error: "Self-review is not allowed" }, { status: 400 });
    }
    if (msg.includes("unique") || msg.includes("duplicate") || insertErr.code === "23505") {
      return NextResponse.json({ error: "You have already submitted a review for this deal" }, { status: 409 });
    }
    return NextResponse.json({ error: msg || "Failed to create review" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, review });
}
