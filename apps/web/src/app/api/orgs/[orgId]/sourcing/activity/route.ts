/**
 * GET /api/orgs/[orgId]/sourcing/activity?profile_id= — stored workflow activity + derived pipeline milestones (grounded).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type TimelineItem = {
  id: string;
  at: string;
  kind: string;
  source: "workflow" | "pipeline";
  detail: Record<string, unknown>;
  actor_user_id?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertOrgMember(supabase: any, orgId: string, userId: string) {
  const { data } = await supabase.from("org_members").select("id").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
  return !!data;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  const orgId = (await params).orgId;
  const profileId = request.nextUrl.searchParams.get("profile_id")?.trim() ?? "";
  if (!profileId) return NextResponse.json({ error: "profile_id required" }, { status: 400 });

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
  if (!(await assertOrgMember(supabase, orgId, user.id))) {
    return NextResponse.json({ error: "Not an org member" }, { status: 403 });
  }

  const { data: stored, error: sErr } = await supabase
    .from("org_sourcing_workflow_activity")
    .select("id, kind, detail, actor_user_id, created_at")
    .eq("org_id", orgId)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(60);

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

  const timeline: TimelineItem[] = (stored ?? []).map((r) => ({
    id: `w-${(r as { id: string }).id}`,
    at: (r as { created_at: string }).created_at,
    kind: (r as { kind: string }).kind,
    source: "workflow" as const,
    detail: ((r as { detail: unknown }).detail as Record<string, unknown>) ?? {},
    actor_user_id: (r as { actor_user_id: string | null }).actor_user_id,
  }));

  const { data: jobs } = await supabase.from("jobs").select("id").eq("org_id", orgId);
  const jobIds = (jobs ?? []).map((j: { id: string }) => j.id);

  const { data: jiRows } = await supabase
    .from("org_job_invites")
    .select("id, job_id, invited_at, viewed_at, creator_response, creator_responded_at")
    .eq("org_id", orgId)
    .eq("profile_id", profileId)
    .order("invited_at", { ascending: false });

  for (const j of jiRows ?? []) {
    const row = j as {
      id: string;
      job_id: string;
      invited_at: string;
      viewed_at: string | null;
      creator_response: string | null;
      creator_responded_at: string | null;
    };
    timeline.push({
      id: `p-inv-${row.id}`,
      at: row.invited_at,
      kind: "job_invite_sent",
      source: "pipeline",
      detail: { job_id: row.job_id, invite_id: row.id },
    });
    if (row.viewed_at) {
      timeline.push({
        id: `p-view-${row.id}`,
        at: row.viewed_at,
        kind: "job_invite_opened",
        source: "pipeline",
        detail: { job_id: row.job_id },
      });
    }
    const cr = row.creator_response ?? "pending";
    if (cr !== "pending") {
      const at = row.creator_responded_at || row.invited_at;
      timeline.push({
        id: `p-cr-${row.id}-${at}`,
        at,
        kind: "creator_response",
        source: "pipeline",
        detail: { job_id: row.job_id, response: cr },
      });
    }
  }

  if (jobIds.length > 0) {
    const { data: apps } = await supabase
      .from("applications")
      .select("id, job_id, created_at")
      .eq("applicant_profile_id", profileId)
      .eq("applicant_type", "profile")
      .in("job_id", jobIds);
    for (const a of apps ?? []) {
      const row = a as { id: string; job_id: string; created_at: string };
      timeline.push({
        id: `p-app-${row.id}`,
        at: row.created_at,
        kind: "application_submitted",
        source: "pipeline",
        detail: { job_id: row.job_id, application_id: row.id },
      });
    }
  }

  const { data: dealRows } = await supabase
    .from("deals")
    .select("id, job_id, created_at, status")
    .eq("org_id", orgId)
    .eq("profile_id", profileId)
    .eq("status", "active");
  for (const d of dealRows ?? []) {
    const row = d as { id: string; job_id: string | null; created_at: string };
    timeline.push({
      id: `p-deal-${row.id}`,
      at: row.created_at,
      kind: "deal_active",
      source: "pipeline",
      detail: { deal_id: row.id, job_id: row.job_id },
    });
  }

  const { data: programs } = await supabase.from("creator_programs").select("id").eq("org_id", orgId);
  const progIds = (programs ?? []).map((p: { id: string }) => p.id);
  if (progIds.length > 0) {
    const { data: piRows } = await supabase
      .from("creator_program_invites")
      .select("id, creator_program_id, invited_at")
      .eq("profile_id", profileId)
      .in("creator_program_id", progIds);
    for (const p of piRows ?? []) {
      const row = p as { id: string; creator_program_id: string; invited_at: string };
      timeline.push({
        id: `p-prog-${row.id}`,
        at: row.invited_at,
        kind: "program_invite_sent",
        source: "pipeline",
        detail: { program_id: row.creator_program_id, invite_id: row.id },
      });
    }
  }

  timeline.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const merged = timeline.slice(0, 80);

  return NextResponse.json({ timeline: merged });
}
