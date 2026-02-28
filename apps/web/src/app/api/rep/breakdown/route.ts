/**
 * GET /api/rep/breakdown?profile_id=...
 * Returns REP breakdown for the given profile. Auth required; profile_id must be current user.
 * Does not write; computes on demand.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { computeRep } from "@/lib/repScore";

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profileId = request.nextUrl.searchParams.get("profile_id")?.trim();
  if (!profileId) {
    return NextResponse.json({ error: "profile_id required" }, { status: 400 });
  }
  if (profileId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { createServiceSupabase } = await import("@/lib/x-analytics-server");
  const serviceSupabase = createServiceSupabase();
  const result = await computeRep(profileId, serviceSupabase, { write: false });

  return NextResponse.json({
    rep: result.rep,
    socialBase: result.socialBase,
    proofOfWork: result.proofOfWork,
    networkTrust: result.networkTrust,
    breakdown: result.breakdown,
  });
}
