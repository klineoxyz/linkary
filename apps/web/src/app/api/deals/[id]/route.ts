import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** GET: Fetch deal by id. Caller must be profile or org party (RLS). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id;
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

  const { data: deal, error } = await supabase
    .from("deals")
    .select("id, profile_id, org_id, job_id, application_id, status, created_at, updated_at, delivered_at, accepted_at, completed_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const isProfileParty = deal.profile_id === user.id;
  const { data: orgMembers } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", deal.org_id)
    .eq("user_id", user.id)
    .limit(1);
  const isOrgParty = (orgMembers?.length ?? 0) > 0;

  const { data: job } = deal.job_id
    ? await supabase.from("jobs").select("id, title, status").eq("id", deal.job_id).maybeSingle()
    : { data: null };
  const { data: existingReviews } = await supabase
    .from("reviews")
    .select("id, reviewer_type, reviewer_profile_id, reviewer_org_id")
    .eq("deal_id", id);

  const canMarkDelivered = isProfileParty && !deal.delivered_at && deal.status === "active";
  const canMarkAccepted = isOrgParty && deal.delivered_at && !deal.accepted_at;
  const alreadyReviewedAsProfile = (existingReviews ?? []).some((r) => r.reviewer_type === "profile" && r.reviewer_profile_id === user.id);
  const alreadyReviewedAsOrg = (existingReviews ?? []).some((r) => r.reviewer_type === "org" && r.reviewer_org_id === deal.org_id);
  const canLeaveReview =
    deal.status === "completed" &&
    ((isProfileParty && !alreadyReviewedAsProfile) || (isOrgParty && !alreadyReviewedAsOrg));

  return NextResponse.json({
    deal: {
      ...deal,
      job: job ?? null,
    },
    canMarkDelivered,
    canMarkAccepted,
    canLeaveReview,
    existingReviews: existingReviews ?? [],
  });
}
