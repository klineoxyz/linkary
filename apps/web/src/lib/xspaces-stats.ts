/**
 * Shared read-only stats for XSpaces analytics and reputation.
 * Used by GET /api/xspaces/analytics and GET /api/xspaces/reputation.
 * No endpoint-to-endpoint calls; formulas preserved from original analytics route.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type XSpacesAnalyticsShape = {
  host: {
    hosted_spaces: number;
    sponsor_proposals_received: number;
    sponsor_proposals_accepted: number;
    sponsor_proposals_declined: number;
    sponsor_acceptance_rate: number | null;
  };
  speaker: {
    applications: number;
    approved: number;
    declined: number;
    withdrawn: number;
    approval_rate: number | null;
  };
  project: {
    proposals_sent: number;
    proposals_accepted: number;
    proposals_declined: number;
    proposals_pending: number;
    acceptance_rate: number | null;
  };
  accepted_sponsorship_volume: number | null;
};

export async function getXSpacesAnalytics(
  supabase: SupabaseClient,
  uid: string
): Promise<XSpacesAnalyticsShape> {
  const { count: hostedSpacesCount } = await supabase
    .from("spaces")
    .select("id", { count: "exact", head: true })
    .eq("host_profile_id", uid);
  const hosted_spaces = typeof hostedSpacesCount === "number" ? hostedSpacesCount : 0;

  let sponsor_proposals_received = 0;
  let sponsor_proposals_accepted_host = 0;
  let sponsor_proposals_declined_host = 0;
  if (hosted_spaces > 0) {
    const { data: mySpaces } = await supabase.from("spaces").select("id").eq("host_profile_id", uid);
    const spaceIds = (mySpaces ?? []).map((s: { id: string }) => s.id);
    if (spaceIds.length > 0) {
      const { data: hostProposals } = await supabase
        .from("space_sponsor_proposals")
        .select("status")
        .in("space_id", spaceIds);
      const list = (hostProposals ?? []) as { status: string }[];
      sponsor_proposals_received = list.length;
      sponsor_proposals_accepted_host = list.filter((r) => r.status === "accepted").length;
      sponsor_proposals_declined_host = list.filter((r) => r.status === "declined").length;
    }
  }
  const host_accept_denom = sponsor_proposals_accepted_host + sponsor_proposals_declined_host;
  const host_sponsor_acceptance_rate =
    host_accept_denom > 0
      ? Math.round((sponsor_proposals_accepted_host / host_accept_denom) * 1000) / 1000
      : null;

  const { data: speakerRows } = await supabase
    .from("speaker_requests")
    .select("status")
    .eq("requester_profile_id", uid);
  const speakerList = (speakerRows ?? []) as { status: string }[];
  const speaker_applications = speakerList.length;
  const speaker_approved = speakerList.filter((r) => r.status === "approved").length;
  const speaker_declined = speakerList.filter((r) => r.status === "declined").length;
  const speaker_withdrawn = speakerList.filter((r) => r.status === "withdrawn").length;
  const speaker_approval_denom = speaker_approved + speaker_declined;
  const speaker_approval_rate =
    speaker_approval_denom > 0
      ? Math.round((speaker_approved / speaker_approval_denom) * 1000) / 1000
      : null;

  const { data: projectRows } = await supabase
    .from("space_sponsor_proposals")
    .select("status, offer_amount")
    .eq("project_profile_id", uid);
  const projectList = (projectRows ?? []) as { status: string; offer_amount: number }[];
  const proposals_sent = projectList.length;
  const proposals_accepted = projectList.filter((r) => r.status === "accepted").length;
  const proposals_declined = projectList.filter((r) => r.status === "declined").length;
  const proposals_pending = projectList.filter((r) => r.status === "pending").length;
  const project_accept_denom = proposals_accepted + proposals_declined;
  const project_acceptance_rate =
    project_accept_denom > 0
      ? Math.round((proposals_accepted / project_accept_denom) * 1000) / 1000
      : null;

  const accepted_sponsorship_volume = projectList
    .filter(
      (r) =>
        r.status === "accepted" &&
        typeof r.offer_amount === "number" &&
        Number.isFinite(r.offer_amount)
    )
    .reduce((sum, r) => sum + Number(r.offer_amount), 0);

  return {
    host: {
      hosted_spaces,
      sponsor_proposals_received,
      sponsor_proposals_accepted: sponsor_proposals_accepted_host,
      sponsor_proposals_declined: sponsor_proposals_declined_host,
      sponsor_acceptance_rate: host_sponsor_acceptance_rate,
    },
    speaker: {
      applications: speaker_applications,
      approved: speaker_approved,
      declined: speaker_declined,
      withdrawn: speaker_withdrawn,
      approval_rate: speaker_approval_rate,
    },
    project: {
      proposals_sent,
      proposals_accepted,
      proposals_declined,
      proposals_pending,
      acceptance_rate: project_acceptance_rate,
    },
    accepted_sponsorship_volume:
      accepted_sponsorship_volume > 0 || proposals_accepted > 0 ? accepted_sponsorship_volume : null,
  };
}

export async function getApprovedSpeakersTotal(
  supabase: SupabaseClient,
  uid: string
): Promise<number> {
  const { data: mySpaces } = await supabase.from("spaces").select("id").eq("host_profile_id", uid);
  const spaceIds = (mySpaces ?? []).map((s: { id: string }) => s.id);
  if (spaceIds.length === 0) return 0;
  const { count } = await supabase
    .from("speaker_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved")
    .in("space_id", spaceIds);
  return typeof count === "number" ? count : 0;
}
