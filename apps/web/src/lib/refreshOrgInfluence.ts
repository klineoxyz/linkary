/**
 * Compute and persist org influence rollup (total_influence + breakdown).
 * Used by worker cron and after supporter/ambassador/affiliate/subsidiary changes.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { computeLinkaryInfluence } from "./linkaryScore";

const MAX_SUBSIDIARY_DEPTH = 5;

function getServiceSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL required");
  return createClient(url, key);
}

export async function refreshOrgInfluenceRollup(orgId: string): Promise<{ total_influence: number; breakdown: Record<string, unknown> }> {
  const supabase = getServiceSupabase();

  const { data: org } = await supabase.from("orgs").select("id, xscore, parent_org_id").eq("id", orgId).maybeSingle();
  if (!org) throw new Error("Org not found");

  const { data: reviewRows } = await supabase
    .from("reviews")
    .select("id")
    .eq("reviewee_type", "org")
    .eq("reviewee_org_id", orgId)
    .eq("verified_deal", true);
  const verifiedReviewsCount = (reviewRows ?? []).length;

  const { data: ambRows } = await supabase
    .from("org_ambassadors")
    .select("id")
    .eq("org_id", orgId)
    .in("status", ["active", "invited"]);
  const activeAmbassadorsCount = (ambRows ?? []).length;

  const { data: affRows } = await supabase
    .from("org_affiliations")
    .select("id")
    .eq("org_id", orgId)
    .in("status", ["active", "invited"]);
  const activeAffiliatesCount = (affRows ?? []).length;

  const { count: supportersCount } = await supabase
    .from("org_supporters")
    .select("profile_id", { count: "exact", head: true })
    .eq("org_id", orgId);
  const supporters = typeof supportersCount === "number" ? supportersCount : 0;

  const subsidiariesInfluence: number[] = [];
  const seen = new Set<string>([orgId]);
  let depth = 0;
  let childIds: string[] = [orgId];
  while (depth < MAX_SUBSIDIARY_DEPTH && childIds.length > 0) {
    const { data: children } = await supabase
      .from("orgs")
      .select("id")
      .in("parent_org_id", childIds);
    const nextIds = (children ?? []).map((c: { id: string }) => c.id).filter((id: string) => !seen.has(id));
    for (const id of nextIds) seen.add(id);
    if (nextIds.length === 0) break;
    for (const subId of nextIds) {
      const subRollup = await supabase.from("org_influence_rollups").select("total_influence").eq("org_id", subId).maybeSingle();
      const val = (subRollup.data as { total_influence?: number } | null)?.total_influence;
      if (typeof val === "number" && Number.isFinite(val)) subsidiariesInfluence.push(val / 10);
    }
    childIds = nextIds;
    depth++;
  }

  const { score1000, breakdown: baseBreakdown } = computeLinkaryInfluence({
    ethosScore: (org as { xscore?: number }).xscore ?? null,
    xscore: (org as { xscore?: number }).xscore ?? null,
    verifiedReviewsCount,
    activeAmbassadorsCount,
    activeAffiliatesCount,
    subsidiariesInfluence: subsidiariesInfluence.length ? subsidiariesInfluence : undefined,
  });

  const breakdown = {
    ...baseBreakdown,
    supportersCount: supporters,
    activeAmbassadorsCount,
    activeAffiliatesCount,
    verifiedReviewsCount,
  };

  await supabase.from("org_influence_rollups").upsert(
    {
      org_id: orgId,
      total_influence: score1000,
      breakdown,
      computed_at: new Date().toISOString(),
    },
    { onConflict: "org_id" }
  );

  return { total_influence: score1000, breakdown };
}
