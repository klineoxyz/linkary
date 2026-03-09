/**
 * GET /api/overview/stats
 * Real platform metrics for the Overview page. No mock data.
 * Public; no auth required.
 */
import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/x-analytics-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export type OverviewStats = {
  creators_total: number;
  projects_total: number;
  opportunities_live: number;
  collaborations_done: number;
  reviews_verified: number;
  rep_profiles: number;
  missing_sources: string[];
};

export async function GET() {
  const missing_sources: string[] = [];
  const stats: OverviewStats = {
    creators_total: 0,
    projects_total: 0,
    opportunities_live: 0,
    collaborations_done: 0,
    reviews_verified: 0,
    rep_profiles: 0,
    missing_sources: [],
  };

  let supabase;
  try {
    supabase = createServiceSupabase();
  } catch {
    return NextResponse.json(
      { error: "Service unavailable", ...stats, missing_sources: ["config"] },
      { status: 503 }
    );
  }

  try {
    const [
      creatorsRes,
      orgsRes,
      companyProfilesRes,
      opportunitiesRes,
      doneRes,
      reviewsRes,
      repRes,
    ] = await Promise.allSettled([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("published", true)
        .not("username", "is", null)
        .neq("username", "")
        .or("account_type.eq.individual,account_type.is.null"),
      supabase.from("orgs").select("id", { count: "exact", head: true }).eq("published", true),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("published", true)
        .eq("account_type", "company"),
      supabase
        .from("collab_requests")
        .select("id", { count: "exact", head: true })
        .in("status", ["new", "accepted"]),
      supabase
        .from("collab_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "done"),
      supabase.from("collab_reviews").select("id", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .not("rep_score", "is", null),
    ]);

  type Row = { count?: number | null; error?: { message?: string } | null };
  const countFrom = (s: PromiseSettledResult<unknown>): number | null => {
    if (s.status !== "fulfilled") return null;
    const v = s.value as Row;
    if (v?.error != null || v?.count == null) return null;
    return typeof v.count === "number" ? v.count : null;
  };

  const c = countFrom(creatorsRes);
  if (c != null) stats.creators_total = c;
  else missing_sources.push("profiles");

  const orgCount = countFrom(orgsRes);
  const companyCount = countFrom(companyProfilesRes);
  stats.projects_total = (orgCount ?? 0) + (companyCount ?? 0);
  if (orgCount == null && companyCount == null) missing_sources.push("orgs");

  const opp = countFrom(opportunitiesRes);
  if (opp != null) stats.opportunities_live = opp;
  else missing_sources.push("collab_requests");

  const done = countFrom(doneRes);
  if (done != null) stats.collaborations_done = done;

  const rev = countFrom(reviewsRes);
  if (rev != null) stats.reviews_verified = rev;
  else missing_sources.push("collab_reviews");

  const rep = countFrom(repRes);
  if (rep != null) stats.rep_profiles = rep;
  else if (!missing_sources.includes("profiles")) missing_sources.push("profiles_rep");

  stats.missing_sources = missing_sources;
  return NextResponse.json(stats);
  } catch (e) {
    return NextResponse.json(
      { error: "Query failed", ...stats, missing_sources: ["query"] },
      { status: 500 }
    );
  }
}
