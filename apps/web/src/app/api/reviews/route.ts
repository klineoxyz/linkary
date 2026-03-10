import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST: Create a review.
 * v1: Only verified reviews. Two paths:
 * - Gig deal: body { reviewee_profile_id, rating, body?, title?, verified_deal: true }. Uses gig_deals.
 * - Org deal: body { deal_id, rating, body?, title?, verified_deal: true }. Caller must be profile or org party; DB trigger enforces completed deal and parties.
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

  if (body.verified_deal !== true) {
    return NextResponse.json(
      { error: "Only verified reviews are allowed. Pass verified_deal: true and either reviewee_profile_id (gig) or deal_id (org deal)." },
      { status: 400 }
    );
  }

  const reviewerProfileId = getProfileIdForAuthUser(user.id);

  // Path 1: Org deal — body.deal_id provided
  const orgDealId = typeof body.deal_id === "string" ? body.deal_id.trim() || null : null;
  if (orgDealId) {
    const { data: deal, error: dealErr } = await supabase
      .from("deals")
      .select("id, profile_id, org_id, status")
      .eq("id", orgDealId)
      .maybeSingle();
    if (dealErr || !deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }
    const d = deal as { id: string; profile_id: string; org_id: string; status: string };
    if (d.status !== "completed") {
      return NextResponse.json({ error: "Reviews only allowed for completed deals" }, { status: 400 });
    }
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", d.org_id)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    const isOrgParty = !!membership && ["owner", "admin"].includes((membership as { role: string }).role);
    const isProfileParty = d.profile_id === reviewerProfileId;
    if (!isProfileParty && !isOrgParty) {
      return NextResponse.json({ error: "Only a party to this deal can leave a review" }, { status: 403 });
    }
    const reviewer_type = isProfileParty ? "profile" : "org";
    const reviewer_profile_id = isProfileParty ? reviewerProfileId : null;
    const reviewer_org_id = isOrgParty ? d.org_id : null;
    const reviewee_type = isProfileParty ? "org" : "profile";
    const reviewee_profile_id = isProfileParty ? null : d.profile_id;
    const reviewee_org_id = isProfileParty ? d.org_id : null;
    const { data: review, error: insertErr } = await supabase
      .from("reviews")
      .insert({
        deal_id: d.id,
        gig_deal_id: null,
        reviewer_type,
        reviewer_profile_id,
        reviewer_org_id,
        reviewee_type,
        reviewee_profile_id,
        reviewee_org_id,
        rating: Math.round(rating),
        body: typeof body.body === "string" ? body.body.trim() || null : null,
        title: typeof body.title === "string" ? body.title.trim() || null : null,
        verified_deal: true,
      })
      .select("id, deal_id, rating, body, title, created_at")
      .single();
    if (insertErr) {
      const msg = insertErr.message ?? "";
      if (msg.includes("unique") || msg.includes("duplicate") || insertErr.code === "23505") {
        return NextResponse.json({ error: "You have already submitted a review for this deal" }, { status: 409 });
      }
      return NextResponse.json({ error: msg || "Failed to create review" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, review });
  }

  // Path 2: Gig deal — reviewee_profile_id
  const revieweeProfileId = typeof body.reviewee_profile_id === "string" ? body.reviewee_profile_id.trim() : null;
  if (!revieweeProfileId) {
    return NextResponse.json({ error: "reviewee_profile_id (gig) or deal_id (org deal) is required" }, { status: 400 });
  }
  if (revieweeProfileId === reviewerProfileId) {
    return NextResponse.json({ error: "Self-review is not allowed" }, { status: 400 });
  }

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
