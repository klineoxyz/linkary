/**
 * GET /api/profiles/[id]/xspaces-credibility — public-safe XSpaces aggregates for a profile.
 * No auth required. Returns only: hosted_spaces_total, approved_speakers_total, sponsor_proposals_accepted.
 * No rates, wallet, messages, pitches, or deliverables.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: profileId } = await params;
  if (!profileId || typeof profileId !== "string" || profileId.trim() === "") {
    return NextResponse.json(
      { error: "Invalid profile id", hosted_spaces_total: 0, approved_speakers_total: 0, sponsor_proposals_accepted: 0 },
      { status: 400 }
    );
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { hosted_spaces_total: 0, approved_speakers_total: 0, sponsor_proposals_accepted: 0 },
      { status: 200 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { count: hostedSpacesCount } = await supabase
    .from("spaces")
    .select("id", { count: "exact", head: true })
    .eq("host_profile_id", profileId);
  const hosted_spaces_total = typeof hostedSpacesCount === "number" ? hostedSpacesCount : 0;

  let sponsor_proposals_accepted = 0;
  let approved_speakers_total = 0;

  if (hosted_spaces_total > 0) {
    const { data: mySpaces } = await supabase
      .from("spaces")
      .select("id")
      .eq("host_profile_id", profileId);
    const spaceIds = (mySpaces ?? []).map((s: { id: string }) => s.id);
    if (spaceIds.length > 0) {
      const { count: acceptedCount } = await supabase
        .from("space_sponsor_proposals")
        .select("id", { count: "exact", head: true })
        .in("space_id", spaceIds)
        .eq("status", "accepted");
      sponsor_proposals_accepted = typeof acceptedCount === "number" ? acceptedCount : 0;

      const { count: approvedSpeakersCount } = await supabase
        .from("speaker_requests")
        .select("id", { count: "exact", head: true })
        .in("space_id", spaceIds)
        .eq("status", "approved");
      approved_speakers_total = typeof approvedSpeakersCount === "number" ? approvedSpeakersCount : 0;
    }
  }

  return NextResponse.json({
    hosted_spaces_total,
    approved_speakers_total,
    sponsor_proposals_accepted,
  });
}
