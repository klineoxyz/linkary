/**
 * GET /api/work/mine — unified completed work (org deals + gig deals) for the current user.
 * Returns minimal, safe work-relevant data with normalized action state:
 * alreadyReviewed, canReview, canCreateCaseStudy, reviewActionType, hasCaseStudy, caseStudyId.
 * No private metadata or internal admin fields.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type WorkItemKind = "gig" | "org";

export type WorkItem = {
  id: string;
  kind: WorkItemKind;
  title: string | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  workTypeLabel: string;
  counterparty: { display_name: string | null; username: string | null; label: string } | null;
  alreadyReviewed: boolean;
  canReview: boolean;
  canCreateCaseStudy: boolean;
  reviewActionType: "gig" | "org" | null;
  hasCaseStudy: boolean;
  caseStudyId: string | null;
  deal_id?: string;
  gig_deal_id?: string;
  reviewee_profile_id?: string | null;
};

export async function GET(_request: NextRequest) {
  const authHeader = _request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const myProfileId = getProfileIdForAuthUser(user.id);

  // --- Gig deals (completed only) ---
  const { data: gigRows, error: gigErr } = await supabase
    .from("gig_deals")
    .select("id, gig_id, owner_profile_id, participant_profile_id, status, created_at, updated_at")
    .or(`owner_profile_id.eq.${myProfileId},participant_profile_id.eq.${myProfileId}`)
    .eq("status", "completed")
    .order("updated_at", { ascending: false });

  if (gigErr) return fail("DB_ERROR", gigErr.message, 500);
  const gigDeals = (gigRows ?? []) as Array<{
    id: string;
    gig_id: string;
    owner_profile_id: string;
    participant_profile_id: string;
    status: string;
    created_at: string;
    updated_at: string;
  }>;

  // --- Org deals (completed only): profile party or org member ---
  const { data: orgMemberRows } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("user_id", user.id);
  const myOrgIds = [...new Set((orgMemberRows ?? []).map((r: { org_id: string }) => r.org_id))];

  const orgDealRows: Array<{
    id: string;
    profile_id: string;
    org_id: string;
    job_id: string | null;
    status: string;
    created_at: string;
    completed_at: string | null;
  }> = [];
  const { data: profileDealRows } = await supabase
    .from("deals")
    .select("id, profile_id, org_id, job_id, status, created_at, completed_at")
    .eq("status", "completed")
    .eq("profile_id", myProfileId)
    .order("completed_at", { ascending: false });
  for (const r of (profileDealRows ?? []) as typeof orgDealRows) {
    orgDealRows.push(r);
  }
  if (myOrgIds.length > 0) {
    const { data: orgMemberDealRows } = await supabase
      .from("deals")
      .select("id, profile_id, org_id, job_id, status, created_at, completed_at")
      .eq("status", "completed")
      .in("org_id", myOrgIds)
      .order("completed_at", { ascending: false });
    const seen = new Set(orgDealRows.map((d) => d.id));
    for (const r of (orgMemberDealRows ?? []) as typeof orgDealRows) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        orgDealRows.push(r);
      }
    }
  }
  orgDealRows.sort((a, b) => (b.completed_at || b.created_at).localeCompare(a.completed_at || a.created_at));
  const orgDeals = orgDealRows;

  const gigIds = [...new Set(gigDeals.map((d) => d.gig_id))];
  const gigCounterpartyIds = [...new Set(gigDeals.map((d) => (d.owner_profile_id === myProfileId ? d.participant_profile_id : d.owner_profile_id)))];

  let gigsById: Record<string, { title: string }> = {};
  if (gigIds.length > 0) {
    const { data: gigs } = await supabase.from("gigs").select("id, title").in("id", gigIds);
    for (const g of (gigs ?? []) as Array<{ id: string; title: string }>) {
      gigsById[g.id] = { title: g.title };
    }
  }

  let profilesById: Record<string, { username: string | null; display_name: string | null }> = {};
  if (gigCounterpartyIds.length > 0) {
    const { data: profs } = await supabase
      .from("public_profile_view")
      .select("id, username, display_name")
      .in("id", gigCounterpartyIds);
    for (const p of (profs ?? []) as Array<{ id: string; username: string | null; display_name: string | null }>) {
      profilesById[p.id] = p;
    }
  }

  const jobIds = [...new Set(orgDeals.map((d) => d.job_id).filter(Boolean) as string[])];
  const orgIds = [...new Set(orgDeals.map((d) => d.org_id))];
  let jobsById: Record<string, { title: string }> = {};
  let orgsById: Record<string, { name: string }> = {};
  if (jobIds.length > 0) {
    const { data: jobs } = await supabase.from("jobs").select("id, title").in("id", jobIds);
    for (const j of (jobs ?? []) as Array<{ id: string; title: string }>) {
      jobsById[j.id] = { title: j.title };
    }
  }
  if (orgIds.length > 0) {
    const { data: orgs } = await supabase.from("orgs").select("id, name").in("id", orgIds);
    for (const o of (orgs ?? []) as Array<{ id: string; name: string }>) {
      orgsById[o.id] = { name: o.name };
    }
  }

  // --- Reviews: gig (by my profile) and org (by my profile or my orgs) ---
  const gigDealIds = gigDeals.map((d) => d.id);
  const dealIds = orgDeals.map((d) => d.id);

  let reviewedGigDealIds = new Set<string>();
  if (gigDealIds.length > 0) {
    const { data: revRows } = await supabase
      .from("reviews")
      .select("gig_deal_id")
      .eq("reviewer_type", "profile")
      .eq("reviewer_profile_id", myProfileId)
      .in("gig_deal_id", gigDealIds);
    for (const r of (revRows ?? []) as Array<{ gig_deal_id: string | null }>) {
      if (r.gig_deal_id) reviewedGigDealIds.add(r.gig_deal_id);
    }
  }

  let reviewedDealIds = new Set<string>();
  if (dealIds.length > 0) {
    const { data: revRows } = await supabase
      .from("reviews")
      .select("deal_id, reviewer_type, reviewer_profile_id, reviewer_org_id")
      .in("deal_id", dealIds);
    for (const r of (revRows ?? []) as Array<{ deal_id: string | null; reviewer_type: string; reviewer_profile_id: string | null; reviewer_org_id: string | null }>) {
      if (!r.deal_id) continue;
      const byMe = r.reviewer_type === "profile" && r.reviewer_profile_id === myProfileId;
      const byMyOrg = r.reviewer_type === "org" && r.reviewer_org_id && myOrgIds.includes(r.reviewer_org_id);
      if (byMe || byMyOrg) reviewedDealIds.add(r.deal_id);
    }
  }

  // --- Case studies linked to these deals (owner_profile_id = me) ---
  let caseStudyByDealId: Record<string, string> = {};
  let caseStudyByGigDealId: Record<string, string> = {};
  if (dealIds.length > 0 || gigDealIds.length > 0) {
    const { data: csRows } = await supabase
      .from("case_studies")
      .select("id, deal_id, gig_deal_id")
      .eq("owner_type", "profile")
      .eq("owner_profile_id", myProfileId);
    for (const c of (csRows ?? []) as Array<{ id: string; deal_id: string | null; gig_deal_id: string | null }>) {
      if (c.deal_id) caseStudyByDealId[c.deal_id] = c.id;
      if (c.gig_deal_id) caseStudyByGigDealId[c.gig_deal_id] = c.id;
    }
  }

  const items: WorkItem[] = [];

  for (const d of gigDeals) {
    const counterpartyId = d.owner_profile_id === myProfileId ? d.participant_profile_id : d.owner_profile_id;
    const profile = profilesById[counterpartyId];
    const gig = gigsById[d.gig_id];
    const label = profile?.display_name || profile?.username ? `@${(profile?.username ?? "").replace(/^@/, "")}` : "Counterparty";
    items.push({
      id: d.id,
      kind: "gig",
      title: gig?.title ?? null,
      status: d.status,
      created_at: d.created_at,
      completed_at: d.updated_at ?? null,
      workTypeLabel: "Gig work",
      counterparty: profile ? { display_name: profile.display_name, username: profile.username, label } : { display_name: null, username: null, label: "Counterparty" },
      alreadyReviewed: reviewedGigDealIds.has(d.id),
      canReview: !reviewedGigDealIds.has(d.id),
      canCreateCaseStudy: true,
      reviewActionType: "gig",
      hasCaseStudy: !!caseStudyByGigDealId[d.id],
      caseStudyId: caseStudyByGigDealId[d.id] ?? null,
      gig_deal_id: d.id,
      reviewee_profile_id: counterpartyId,
    });
  }

  for (const d of orgDeals) {
    const job = d.job_id ? jobsById[d.job_id] : null;
    const org = orgsById[d.org_id];
    const isProfileParty = d.profile_id === myProfileId;
    const counterpartyLabel = isProfileParty ? (org?.name ?? "Organization") : "Creator";
    items.push({
      id: d.id,
      kind: "org",
      title: job?.title ?? null,
      status: d.status,
      created_at: d.created_at,
      completed_at: d.completed_at ?? null,
      workTypeLabel: "Org deal",
      counterparty: { display_name: counterpartyLabel, username: null, label: counterpartyLabel },
      alreadyReviewed: reviewedDealIds.has(d.id),
      canReview: !reviewedDealIds.has(d.id),
      canCreateCaseStudy: true,
      reviewActionType: "org",
      hasCaseStudy: !!caseStudyByDealId[d.id],
      caseStudyId: caseStudyByDealId[d.id] ?? null,
      deal_id: d.id,
    });
  }

  items.sort((a, b) => {
    const aAt = a.completed_at || a.created_at;
    const bAt = b.completed_at || b.created_at;
    return bAt.localeCompare(aAt);
  });

  return ok({ items });
}
