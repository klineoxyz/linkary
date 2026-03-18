/**
 * POST /api/orgs/[orgId]/sourcing/creator-workflow — upsert operator workflow + append activity log.
 * Omitted fields preserve existing values (partial-safe).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const STATUSES = new Set([
  "none",
  "needs_review",
  "follow_up_needed",
  "waiting_internal",
  "blocked",
  "resolved",
]);

function parseTs(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertOrgMember(supabase: any, orgId: string, userId: string) {
  const { data } = await supabase.from("org_members").select("id").eq("org_id", orgId).eq("user_id", userId).maybeSingle();
  return !!data;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const orgId = (await params).orgId;
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

  let body: {
    profile_id?: string;
    assignee_user_id?: string | null;
    follow_up_status?: string;
    internal_note?: string | null;
    follow_up_due_at?: string | null;
    snoozed_until?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const profileId = typeof body.profile_id === "string" ? body.profile_id.trim() : "";
  if (!profileId) return NextResponse.json({ error: "profile_id required" }, { status: 400 });

  const { data: existing } = await supabase
    .from("org_sourcing_creator_workflow")
    .select("*")
    .eq("org_id", orgId)
    .eq("profile_id", profileId)
    .maybeSingle();

  const ex = existing as Record<string, unknown> | null;

  let assignee: string | null = (ex?.assignee_user_id as string | null) ?? null;
  if (body.assignee_user_id !== undefined) {
    if (body.assignee_user_id === null || body.assignee_user_id === "") {
      assignee = null;
    } else if (typeof body.assignee_user_id === "string") {
      const { data: mem } = await supabase
        .from("org_members")
        .select("user_id")
        .eq("org_id", orgId)
        .eq("user_id", body.assignee_user_id)
        .maybeSingle();
      if (!mem) return NextResponse.json({ error: "Assignee must be an org member" }, { status: 400 });
      assignee = body.assignee_user_id;
    }
  }

  let status = (ex?.follow_up_status as string) ?? "none";
  if (typeof body.follow_up_status === "string") status = body.follow_up_status;
  if (!STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid follow_up_status" }, { status: 400 });
  }

  let note: string | null =
    ex?.internal_note !== undefined && ex?.internal_note !== null ? String(ex.internal_note) : null;
  if (body.internal_note !== undefined) {
    note = body.internal_note === null ? null : String(body.internal_note).slice(0, 500);
  }

  let dueAt: string | null = ex?.follow_up_due_at ? new Date(ex.follow_up_due_at as string).toISOString() : null;
  if (body.follow_up_due_at !== undefined) {
    const p = parseTs(body.follow_up_due_at);
    if (body.follow_up_due_at && String(body.follow_up_due_at).trim() !== "" && !p) {
      return NextResponse.json({ error: "Invalid follow_up_due_at" }, { status: 400 });
    }
    dueAt = p;
  }

  let snoozeUntil: string | null = ex?.snoozed_until ? new Date(ex.snoozed_until as string).toISOString() : null;
  if (body.snoozed_until !== undefined) {
    const p = parseTs(body.snoozed_until);
    if (body.snoozed_until && String(body.snoozed_until).trim() !== "" && !p) {
      return NextResponse.json({ error: "Invalid snoozed_until" }, { status: 400 });
    }
    snoozeUntil = p;
  }

  const prevAssignee = (ex?.assignee_user_id as string | null) ?? null;
  const prevStatus = (ex?.follow_up_status as string) ?? "none";
  const prevNote = (ex?.internal_note as string | null) ?? null;
  const prevDue = ex?.follow_up_due_at ? new Date(ex.follow_up_due_at as string).toISOString() : null;
  const prevSnooze = ex?.snoozed_until ? new Date(ex.snoozed_until as string).toISOString() : null;

  const nowIso = new Date().toISOString();
  const activityRows: Array<{
    org_id: string;
    profile_id: string;
    kind: string;
    detail: Record<string, unknown>;
    actor_user_id: string;
  }> = [];

  const pushAct = (kind: string, detail: Record<string, unknown>) => {
    activityRows.push({ org_id: orgId, profile_id: profileId, kind, detail, actor_user_id: user.id });
  };

  if (!ex) {
    pushAct("workflow_initialized", {
      assignee_user_id: assignee,
      follow_up_status: status,
      has_note: !!(note && note.length),
      follow_up_due_at: dueAt,
      snoozed_until: snoozeUntil,
    });
  } else {
    if (prevAssignee !== assignee) pushAct("workflow_assignee", { from: prevAssignee, to: assignee });
    if (prevStatus !== status) pushAct("workflow_follow_up_status", { from: prevStatus, to: status });
    if ((prevNote ?? "") !== (note ?? "")) pushAct("workflow_note", { changed: true });
    if (prevDue !== dueAt) pushAct("workflow_due", { from: prevDue, to: dueAt });
    if (prevSnooze !== snoozeUntil) pushAct("workflow_snooze", { from: prevSnooze, to: snoozeUntil });
  }

  const row = {
    org_id: orgId,
    profile_id: profileId,
    assignee_user_id: assignee,
    follow_up_status: status,
    internal_note: note,
    follow_up_due_at: dueAt,
    snoozed_until: snoozeUntil,
    updated_by: user.id,
    last_operator_action_at: nowIso,
    last_operator_action_by: user.id,
  };

  const { data: upserted, error } = await supabase
    .from("org_sourcing_creator_workflow")
    .upsert(row, { onConflict: "org_id,profile_id" })
    .select(
      "profile_id, assignee_user_id, follow_up_status, internal_note, follow_up_due_at, snoozed_until, last_operator_action_at, last_operator_action_by, updated_at"
    )
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (activityRows.length > 0) {
    const { error: actErr } = await supabase.from("org_sourcing_workflow_activity").insert(activityRows);
    if (actErr) console.error("org_sourcing_workflow_activity insert", actErr.message);
  }

  return NextResponse.json({ workflow: upserted });
}
