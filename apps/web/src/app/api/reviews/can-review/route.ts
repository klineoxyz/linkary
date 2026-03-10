import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET /api/reviews/can-review?username=alice
 * Returns whether the current user can leave a verified review for the given profile,
 * and the deal_id (org) or reviewee_profile_id (gig) to use when submitting.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ canReview: false }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ canReview: false }, { status: 401 });
  }

  const username = request.nextUrl.searchParams.get("username")?.trim()?.replace(/^@/, "");
  if (!username) {
    return NextResponse.json({ canReview: false }, { status: 400 });
  }

  const reviewerProfileId = getProfileIdForAuthUser(user.id);

  const { data: targetProfile } = await supabase
    .from("public_profile_view")
    .select("id")
    .ilike("username", username)
    .maybeSingle();
  const targetProfileId = (targetProfile as { id: string } | null)?.id;
  if (!targetProfileId) {
    return NextResponse.json({ canReview: false }, { status: 404 });
  }
  if (targetProfileId === reviewerProfileId) {
    return NextResponse.json({ canReview: false }, { status: 400 });
  }

  // Org deals: completed deals where target is the profile (creator) and we are org admin
  const { data: orgDeals } = await supabase
    .from("deals")
    .select("id, org_id")
    .eq("profile_id", targetProfileId)
    .eq("status", "completed");
  for (const d of orgDeals ?? []) {
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", (d as { org_id: string }).org_id)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    if (!membership || !["owner", "admin"].includes((membership as { role: string }).role)) continue;
    const { data: existing } = await supabase
      .from("reviews")
      .select("id")
      .eq("deal_id", (d as { id: string }).id)
      .eq("reviewer_type", "org")
      .eq("reviewer_org_id", (d as { org_id: string }).org_id)
      .limit(1);
    if ((existing ?? []).length > 0) continue;
    return NextResponse.json({
      canReview: true,
      dealId: (d as { id: string }).id,
      dealType: "org",
    });
  }

  // Gig deals: completed (or active) where we and target are the two parties
  const { data: gigDeals } = await supabase
    .from("gig_deals")
    .select("id")
    .or(
      `and(owner_profile_id.eq.${reviewerProfileId},participant_profile_id.eq.${targetProfileId}),and(owner_profile_id.eq.${targetProfileId},participant_profile_id.eq.${reviewerProfileId})`
    )
    .in("status", ["active", "completed"]);
  for (const g of gigDeals ?? []) {
    const { data: existing } = await supabase
      .from("reviews")
      .select("id")
      .eq("gig_deal_id", (g as { id: string }).id)
      .eq("reviewer_profile_id", reviewerProfileId)
      .limit(1);
    if ((existing ?? []).length > 0) continue;
    return NextResponse.json({
      canReview: true,
      revieweeProfileId: targetProfileId,
      dealType: "gig",
    });
  }

  return NextResponse.json({ canReview: false });
}
