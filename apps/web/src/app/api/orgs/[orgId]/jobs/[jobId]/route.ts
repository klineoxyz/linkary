import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** PATCH: Update job (e.g. close). Requires Bearer + is_org_admin(orgId). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string; jobId: string }> }
) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orgId, jobId } = await params;
  if (!orgId || !jobId) return NextResponse.json({ error: "orgId and jobId required" }, { status: 400 });

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: isAdmin } = await supabase.rpc("is_org_admin", { p_org_id: orgId, p_uid: user.id });
  if (!isAdmin) {
    return NextResponse.json({ error: "Only org owner or admin can update jobs" }, { status: 403 });
  }

  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("id, org_id, status")
    .eq("id", jobId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  let body: { status?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body?.status;
  const allowed = ["open", "accepted", "completed", "paid"];
  if (typeof status !== "string" || !allowed.includes(status)) {
    return NextResponse.json({ error: "status must be one of: " + allowed.join(", ") }, { status: 400 });
  }

  const { data: updated, error: updateErr } = await supabase
    .from("jobs")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("org_id", orgId)
    .select("id, org_id, type, title, budget, duration, tags, status, created_at, updated_at")
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json(updated);
}
