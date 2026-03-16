/**
 * POST /api/collab-requests/[id]/convert — convert an accepted collab request into verified work (gig_deal).
 * Only the target (accepter) can convert. Creates a gig + gig_deal; no review unlocks until the deal is completed.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const COLLAB_GIG_TITLE = "Collab work";
const COLLAB_GIG_DESCRIPTION = "Verified work from an accepted collab request.";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = (await params).id?.trim();
  if (!id) return fail("BAD_REQUEST", "id is required", 400);

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const myProfileId = getProfileIdForAuthUser(user.id);

  const { data: row, error: fetchErr } = await supabase
    .from("collab_requests")
    .select("id, requester_profile_id, target_profile_id, status, converted_gig_deal_id")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr) return fail("DB_ERROR", fetchErr.message, 500);
  if (!row) return fail("NOT_FOUND", "Request not found", 404);

  const r = row as {
    id: string;
    requester_profile_id: string;
    target_profile_id: string;
    status: string;
    converted_gig_deal_id: string | null;
  };

  if (r.target_profile_id !== myProfileId) {
    return fail("FORBIDDEN", "Only the person who accepted the request can convert it to verified work", 403);
  }
  if (r.status !== "accepted") {
    return fail("BAD_REQUEST", "Only accepted requests can be converted to verified work", 400);
  }
  if (r.converted_gig_deal_id) {
    return ok({
      converted: true,
      gig_deal_id: r.converted_gig_deal_id,
      message: "Already converted to verified work",
    });
  }

  const { data: requesterProfile } = await supabase
    .from("public_profile_view")
    .select("username, display_name")
    .eq("id", r.requester_profile_id)
    .maybeSingle();
  const reqProfile = requesterProfile as { username: string | null; display_name: string | null } | null;
  const requesterLabel = reqProfile?.display_name?.trim() || reqProfile?.username
    ? `@${(reqProfile?.username ?? "").replace(/^@/, "")}`
    : "collab";
  const gigTitle = `${COLLAB_GIG_TITLE} with ${requesterLabel}`;

  const { data: gig, error: gigErr } = await supabase
    .from("gigs")
    .insert({
      owner_profile_id: r.target_profile_id,
      title: gigTitle,
      description: COLLAB_GIG_DESCRIPTION,
      gig_type: "partnership",
      compensation_type: "other",
      budget_text: null,
      location: null,
      remote: true,
      is_public: false,
      status: "closed",
    })
    .select("id")
    .single();

  if (gigErr || !gig) return fail("DB_ERROR", gigErr?.message ?? "Failed to create gig", 500);

  const gigId = (gig as { id: string }).id;

  const { data: deal, error: dealErr } = await supabase
    .from("gig_deals")
    .insert({
      gig_id: gigId,
      owner_profile_id: r.target_profile_id,
      participant_profile_id: r.requester_profile_id,
      status: "active",
      collab_request_id: r.id,
    })
    .select("id")
    .single();

  if (dealErr || !deal) {
    return fail("DB_ERROR", dealErr?.message ?? "Failed to create verified work", 500);
  }

  const gigDealId = (deal as { id: string }).id;

  const { error: updateErr } = await supabase
    .from("collab_requests")
    .update({ converted_gig_deal_id: gigDealId })
    .eq("id", r.id)
    .eq("target_profile_id", myProfileId);

  if (updateErr) {
    return fail("DB_ERROR", updateErr.message, 500);
  }

  return ok({
    converted: true,
    gig_deal_id: gigDealId,
    gig_id: gigId,
    message: "Converted to verified work. Complete the deal in My Work or Deals to unlock reviews and case studies.",
  });
}
