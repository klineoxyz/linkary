import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** POST: Org owner/admin rejects an application. Notifies applicant. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const applicationId = (await params).id;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: app, error: appErr } = await supabase
    .from("applications")
    .select("id, job_id, applicant_type, applicant_profile_id, applicant_org_id, status")
    .eq("id", applicationId)
    .maybeSingle();

  if (appErr || !app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (app.status !== "pending") {
    return NextResponse.json({ error: "Application is not pending" }, { status: 400 });
  }

  const { data: job, error: jobErr } = await supabase
    .from("jobs")
    .select("id, org_id, status")
    .eq("id", app.job_id)
    .maybeSingle();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", job.org_id)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership || !["owner", "admin"].includes((membership as { role: string }).role)) {
    return NextResponse.json({ error: "Only org owner or admin can reject" }, { status: 403 });
  }

  const { error: updateErr } = await supabase
    .from("applications")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", applicationId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const applicantProfileId = app.applicant_type === "profile" ? app.applicant_profile_id : null;
  if (applicantProfileId) {
    try {
      const { createNotification } = await import("@/lib/notifications");
      await createNotification(applicantProfileId, "application_rejected", {
        entity_type: "application",
        entity_id: applicationId,
        payload: { job_id: job.id, org_id: job.org_id },
      });
    } catch (_) {
      /* non-blocking */
    }
  }

  return NextResponse.json({ ok: true });
}
