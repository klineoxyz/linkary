/**
 * GET /api/orgs/[orgId]/sourcing — job invites + program invites with derived applied/deal flags.
 * Org members only. No fake data.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const orgId = (await params).orgId;
  const authHeader = _request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const { data: jiRows, error: jiErr } = await supabase
    .from("org_job_invites")
    .select("id, job_id, profile_id, invited_at, kol_list_id")
    .eq("org_id", orgId)
    .order("invited_at", { ascending: false });
  if (jiErr) return NextResponse.json({ error: jiErr.message }, { status: 500 });

  const jobInvites = (jiRows ?? []) as Array<{
    id: string;
    job_id: string;
    profile_id: string;
    invited_at: string;
    kol_list_id: string | null;
  }>;
  const jobIds = [...new Set(jobInvites.map((r) => r.job_id))];
  const profileIds = [...new Set(jobInvites.map((r) => r.profile_id))];

  const jobsById: Record<string, string> = {};
  if (jobIds.length > 0) {
    const { data: jobs } = await supabase.from("jobs").select("id, title").in("id", jobIds);
    for (const j of jobs ?? []) {
      const row = j as { id: string; title: string };
      jobsById[row.id] = row.title;
    }
  }

  const appKeys = new Set<string>();
  if (jobIds.length > 0 && profileIds.length > 0) {
    const { data: apps } = await supabase
      .from("applications")
      .select("job_id, applicant_profile_id, status")
      .in("job_id", jobIds)
      .in("applicant_profile_id", profileIds);
    for (const a of apps ?? []) {
      const row = a as { job_id: string; applicant_profile_id: string; status: string };
      appKeys.add(`${row.job_id}:${row.applicant_profile_id}`);
    }
  }

  const dealKeys = new Set<string>();
  if (jobIds.length > 0 && profileIds.length > 0) {
    const { data: deals } = await supabase
      .from("deals")
      .select("job_id, profile_id, status")
      .eq("org_id", orgId)
      .in("job_id", jobIds)
      .in("profile_id", profileIds);
    for (const d of deals ?? []) {
      const row = d as { job_id: string | null; profile_id: string; status: string };
      if (row.job_id && row.status === "active") {
        dealKeys.add(`${row.job_id}:${row.profile_id}`);
      }
    }
  }

  const jobInvitesOut = jobInvites.map((inv) => {
    const k = `${inv.job_id}:${inv.profile_id}`;
    return {
      ...inv,
      job_title: jobsById[inv.job_id] ?? "Job",
      has_application: appKeys.has(k),
      has_active_deal: dealKeys.has(k),
    };
  });

  const { data: programs } = await supabase
    .from("creator_programs")
    .select("id, title")
    .eq("org_id", orgId);
  const programIds = (programs ?? []).map((p: { id: string }) => p.id);
  const programInvitesOut: Array<{
    id: string;
    creator_program_id: string;
    program_title: string;
    profile_id: string;
    status: string;
    invited_at: string;
    source_type: string | null;
    source_id: string | null;
  }> = [];

  if (programIds.length > 0) {
    const { data: pi } = await supabase
      .from("creator_program_invites")
      .select("id, creator_program_id, profile_id, status, invited_at, source_type, source_id")
      .in("creator_program_id", programIds)
      .order("invited_at", { ascending: false });
    const titleByProg = Object.fromEntries((programs ?? []).map((p: { id: string; title: string }) => [p.id, p.title]));
    for (const row of pi ?? []) {
      const r = row as {
        id: string;
        creator_program_id: string;
        profile_id: string;
        status: string;
        invited_at: string;
        source_type: string | null;
        source_id: string | null;
      };
      programInvitesOut.push({
        ...r,
        program_title: titleByProg[r.creator_program_id] ?? "Program",
      });
    }
  }

  let shortlistedOrgCount = 0;
  const { data: orgKolListIds } = await supabase
    .from("kol_lists")
    .select("id")
    .eq("owner_type", "org")
    .eq("owner_id", orgId);
  const kolIds = (orgKolListIds ?? []).map((r: { id: string }) => r.id);
  if (kolIds.length > 0) {
    const { count } = await supabase
      .from("kol_list_members")
      .select("id", { count: "exact", head: true })
      .eq("shortlisted", true)
      .in("kol_list_id", kolIds);
    shortlistedOrgCount = count ?? 0;
  }

  return NextResponse.json({
    job_invites: jobInvitesOut,
    program_invites: programInvitesOut,
    shortlisted_org_members_count: shortlistedOrgCount,
    summary: {
      job_invites_count: jobInvitesOut.length,
      program_invites_pending: programInvitesOut.filter((p) => p.status === "invited").length,
      job_invites_applied: jobInvitesOut.filter((j) => j.has_application).length,
      job_invites_active_deal: jobInvitesOut.filter((j) => j.has_active_deal).length,
    },
  });
}
