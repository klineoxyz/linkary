import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST: Create a review for a completed deal.
 * Body: { deal_id, rating (1-5), body?: string, title?: string }
 * Reviewer is inferred from auth (profile or org). Reviewee must be the other party.
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

  let body: { deal_id?: string; rating?: number; body?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dealId = typeof body.deal_id === "string" ? body.deal_id.trim() : null;
  const rating = typeof body.rating === "number" ? body.rating : Number(body.rating);
  if (!dealId) {
    return NextResponse.json({ error: "deal_id is required" }, { status: 400 });
  }
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating must be 1–5" }, { status: 400 });
  }

  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .select("id, profile_id, org_id, status")
    .eq("id", dealId)
    .maybeSingle();

  if (dealErr || !deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }
  if (deal.status !== "completed") {
    return NextResponse.json({ error: "Reviews only allowed for completed deals" }, { status: 400 });
  }

  const isProfileParty = deal.profile_id === user.id;
  const { data: orgMembers } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("org_id", deal.org_id)
    .eq("user_id", user.id)
    .limit(1);
  const isOrgParty = (orgMembers?.length ?? 0) > 0;

  let reviewer_type: "profile" | "org";
  let reviewer_profile_id: string | null;
  let reviewer_org_id: string | null;
  let reviewee_type: "profile" | "org";
  let reviewee_profile_id: string | null;
  let reviewee_org_id: string | null;

  if (isProfileParty) {
    reviewer_type = "profile";
    reviewer_profile_id = user.id;
    reviewer_org_id = null;
    reviewee_type = "org";
    reviewee_profile_id = null;
    reviewee_org_id = deal.org_id;
  } else if (isOrgParty) {
    reviewer_type = "org";
    reviewer_profile_id = null;
    reviewer_org_id = deal.org_id;
    reviewee_type = "profile";
    reviewee_profile_id = deal.profile_id;
    reviewee_org_id = null;
  } else {
    return NextResponse.json({ error: "You are not a party to this deal" }, { status: 403 });
  }

  const { data: review, error: insertErr } = await supabase
    .from("reviews")
    .insert({
      deal_id: dealId,
      reviewer_type,
      reviewer_profile_id,
      reviewer_org_id,
      reviewee_type,
      reviewee_profile_id,
      reviewee_org_id,
      rating: Math.round(rating),
      body: typeof body.body === "string" ? body.body.trim() || null : null,
      title: typeof body.title === "string" ? body.title.trim() || null : null,
    })
    .select("id, deal_id, rating, body, title, created_at")
    .single();

  if (insertErr) {
    const msg = insertErr.message ?? "";
    if (msg.includes("reviews_check_deal_and_parties") || msg.includes("Reviews only allowed")) {
      return NextResponse.json({ error: "Reviews only allowed for completed deals" }, { status: 400 });
    }
    if (msg.includes("Self-review") || msg.includes("self_review")) {
      return NextResponse.json({ error: "Self-review is not allowed" }, { status: 400 });
    }
    if (msg.includes("unique") || msg.includes("duplicate") || insertErr.code === "23505") {
      return NextResponse.json({ error: "You have already submitted a review for this deal" }, { status: 409 });
    }
    return NextResponse.json({ error: msg || "Failed to create review" }, { status: 500 });
  }

  if (reviewee_type === "org" && reviewee_org_id) {
    try {
      const { enqueueInfluenceRefresh } = await import("@/lib/refreshOrgInfluence");
      await enqueueInfluenceRefresh(reviewee_org_id);
    } catch (_) {
      /* non-blocking */
    }
  }

  return NextResponse.json({ ok: true, review });
}
