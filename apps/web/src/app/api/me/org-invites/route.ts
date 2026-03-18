/**
 * GET /api/me/org-invites — creator-facing: job invites + program invites for the signed-in profile.
 * Grounded in org_job_invites + creator_program_invites. RLS: invitee + existing program policies.
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
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  const pid = user.id;

  const { data: jiRows, error: jiErr } = await supabase
    .from("org_job_invites")
    .select("id, org_id, job_id, invited_at, creator_response, creator_responded_at, viewed_at")
    .eq("profile_id", pid)
    .order("invited_at", { ascending: false });
  if (jiErr) return NextResponse.json({ error: jiErr.message }, { status: 500 });

  const jobInvites = (jiRows ?? []) as Array<{
    id: string;
    org_id: string;
    job_id: string;
    invited_at: string;
    creator_response?: string;
    creator_responded_at?: string | null;
    viewed_at?: string | null;
  }>;
  const orgIds = [...new Set(jobInvites.map((r) => r.org_id))];
  const jobIds = [...new Set(jobInvites.map((r) => r.job_id))];

  const orgById: Record<string, { id: string; name: string; slug: string | null }> = {};
  if (orgIds.length > 0) {
    const { data: orgs } = await supabase.from("orgs").select("id, name, slug").in("id", orgIds);
    for (const o of orgs ?? []) {
      const r = o as { id: string; name: string; slug: string | null };
      orgById[r.id] = r;
    }
  }

  const jobById: Record<string, { id: string; title: string; apply_url: string | null; status: string }> = {};
  if (jobIds.length > 0) {
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id, title, apply_url, status, org_id")
      .in("id", jobIds);
    for (const j of jobs ?? []) {
      const r = j as { id: string; title: string; apply_url: string | null; status: string };
      jobById[r.id] = r;
    }
  }

  const appByJob = new Map<string, { status: string }>();
  if (jobIds.length > 0) {
    const { data: apps } = await supabase
      .from("applications")
      .select("job_id, status")
      .eq("applicant_profile_id", pid)
      .in("job_id", jobIds);
    for (const a of apps ?? []) {
      const r = a as { job_id: string; status: string };
      appByJob.set(r.job_id, { status: r.status });
    }
  }

  const dealByJob = new Map<string, { id: string }>();
  if (jobIds.length > 0) {
    const { data: deals } = await supabase
      .from("deals")
      .select("id, job_id, org_id, status")
      .eq("profile_id", pid)
      .eq("status", "active")
      .in("job_id", jobIds);
    for (const d of deals ?? []) {
      const r = d as { id: string; job_id: string | null };
      if (r.job_id) dealByJob.set(r.job_id, { id: r.id });
    }
  }

  const job_invites_out = jobInvites.map((inv) => {
    const app = appByJob.get(inv.job_id);
    const deal = dealByJob.get(inv.job_id);
    return {
      id: inv.id,
      invited_at: inv.invited_at,
      creator_response: inv.creator_response ?? "pending",
      creator_responded_at: inv.creator_responded_at ?? null,
      viewed_at: inv.viewed_at ?? null,
      org: orgById[inv.org_id] ?? { id: inv.org_id, name: "Organization", slug: null },
      job: jobById[inv.job_id] ?? { id: inv.job_id, title: "Job", apply_url: null, status: "" },
      has_application: !!app,
      application_status: app?.status ?? null,
      has_active_deal: !!deal,
      deal_id: deal?.id ?? null,
    };
  });

  const { data: piRows, error: piErr } = await supabase
    .from("creator_program_invites")
    .select("id, creator_program_id, status, invited_at")
    .eq("profile_id", pid)
    .order("invited_at", { ascending: false });
  if (piErr) return NextResponse.json({ error: piErr.message }, { status: 500 });

  const progInvites = (piRows ?? []) as Array<{
    id: string;
    creator_program_id: string;
    status: string;
    invited_at: string;
  }>;
  const progIds = [...new Set(progInvites.map((r) => r.creator_program_id))];
  const progById: Record<string, { id: string; title: string; org_id: string; status: string }> = {};
  if (progIds.length > 0) {
    const { data: programs } = await supabase
      .from("creator_programs")
      .select("id, title, org_id, status")
      .in("id", progIds);
    for (const p of programs ?? []) {
      const r = p as { id: string; title: string; org_id: string; status: string };
      progById[r.id] = r;
    }
  }
  const progOrgIds = [...new Set(Object.values(progById).map((p) => p.org_id))];
  for (const oid of progOrgIds) {
    if (!orgById[oid]) {
      const { data: o } = await supabase.from("orgs").select("id, name, slug").eq("id", oid).maybeSingle();
      if (o) {
        const r = o as { id: string; name: string; slug: string | null };
        orgById[r.id] = r;
      }
    }
  }

  const program_invites_out = progInvites.map((inv) => {
    const prog = progById[inv.creator_program_id];
    return {
      id: inv.id,
      invited_at: inv.invited_at,
      status: inv.status,
      program: prog ?? { id: inv.creator_program_id, title: "Program", org_id: "", status: "" },
      org: prog ? orgById[prog.org_id] ?? { id: prog.org_id, name: "Organization", slug: null } : null,
    };
  });

  return NextResponse.json({ job_invites: job_invites_out, program_invites: program_invites_out });
}
