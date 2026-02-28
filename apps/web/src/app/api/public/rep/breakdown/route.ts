/**
 * GET /api/public/rep/breakdown?username=...
 * Returns REP breakdown for the published profile with that username. No auth.
 * Does not write; computes on demand.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { computeRep } from "@/lib/repScore";
import { normalizeIdentifier } from "@/lib/entityResolver";

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username")?.trim();
  if (!username) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }

  const segment = normalizeIdentifier(username);
  const supabase = createServiceSupabase();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("published", true)
    .or(`username.ilike.${segment},twitter_username.ilike.${segment}`)
    .limit(1)
    .maybeSingle();

  const profileId = (profile as { id?: string } | null)?.id;
  if (!profileId) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const result = await computeRep(profileId, supabase, { write: false });

  return NextResponse.json({
    rep: result.rep,
    socialBase: result.socialBase,
    proofOfWork: result.proofOfWork,
    networkTrust: result.networkTrust,
    breakdown: result.breakdown,
  });
}
