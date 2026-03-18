/**
 * POST /api/orgs/[orgId]/sourcing/creator-workflow — upsert operator workflow row (org member only).
 * Body: { profile_id, assignee_user_id?: string | null, follow_up_status: string, internal_note?: string | null }
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
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const profileId = typeof body.profile_id === "string" ? body.profile_id.trim() : "";
  if (!profileId) return NextResponse.json({ error: "profile_id required" }, { status: 400 });

  const status = typeof body.follow_up_status === "string" ? body.follow_up_status : "none";
  if (!STATUSES.has(status)) {
    return NextResponse.json({ error: "Invalid follow_up_status" }, { status: 400 });
  }

  let assignee: string | null = null;
  if (body.assignee_user_id === null || body.assignee_user_id === "") {
    assignee = null;
  } else if (typeof body.assignee_user_id === "string") {
    assignee = body.assignee_user_id;
    const { data: mem } = await supabase
      .from("org_members")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("user_id", assignee)
      .maybeSingle();
    if (!mem) return NextResponse.json({ error: "Assignee must be an org member" }, { status: 400 });
  }

  const note =
    body.internal_note === null || body.internal_note === undefined
      ? null
      : String(body.internal_note).slice(0, 500);

  const row = {
    org_id: orgId,
    profile_id: profileId,
    assignee_user_id: assignee,
    follow_up_status: status,
    internal_note: note,
    updated_by: user.id,
  };

  const { data: upserted, error } = await supabase
    .from("org_sourcing_creator_workflow")
    .upsert(row, { onConflict: "org_id,profile_id" })
    .select("profile_id, assignee_user_id, follow_up_status, internal_note, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workflow: upserted });
}
