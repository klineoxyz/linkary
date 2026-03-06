/**
 * GET /api/xspaces/analytics — read-only reputation + analytics for current user.
 * Returns aggregated counts and rates only. No sensitive data (no messages, pitches, wallets, etc.).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const uid = user.id;

  // Host: spaces I host
  const { count: hostedSpacesCount } = await supabase
    .from("spaces")
    .select("id", { count: "exact", head: true })
    .eq("host_profile_id", uid);
  const hosted_spaces = typeof hostedSpacesCount === "number" ? hostedSpacesCount : 0;

  // Host: sponsor proposals on my spaces
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
  const host_sponsor_acceptance_rate = host_accept_denom > 0
    ? Math.round((sponsor_proposals_accepted_host / host_accept_denom) * 1000) / 1000
    : null;

  // Speaker: my speaker_requests
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
  const speaker_approval_rate = speaker_approval_denom > 0
    ? Math.round((speaker_approved / speaker_approval_denom) * 1000) / 1000
    : null;

  // Project: my sponsor proposals (as project)
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
  const project_acceptance_rate = project_accept_denom > 0
    ? Math.round((proposals_accepted / project_accept_denom) * 1000) / 1000
    : null;

  const accepted_sponsorship_volume = projectList
    .filter((r) => r.status === "accepted" && typeof r.offer_amount === "number" && Number.isFinite(r.offer_amount))
    .reduce((sum, r) => sum + Number(r.offer_amount), 0);

  return NextResponse.json({
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
    accepted_sponsorship_volume: accepted_sponsorship_volume > 0 || proposals_accepted > 0 ? accepted_sponsorship_volume : null,
  });
}
