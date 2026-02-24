import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

/**
 * POST /api/jobs/[jobId]/apply
 * Apply to a job as current user (profile) or as org. When applying as profile and
 * profile.share_analytics_on_apply is true, fetches x_analytics_rollups and stores
 * as analytics_snapshot_json on the application.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let body: { message?: string; applyAsOrgId?: string } = {};
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    /* empty body ok */
  }

  if (!serviceKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  const service = createClient(supabaseUrl, serviceKey);

  // Verify job exists and get org_id
  const { data: job, error: jobErr } = await service
    .from("jobs")
    .select("id, org_id, status")
    .eq("id", jobId)
    .maybeSingle();
  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if ((job as { status: string }).status !== "open") {
    return NextResponse.json({ error: "Job is not open for applications" }, { status: 400 });
  }

  const applyAsOrgId = body.applyAsOrgId?.trim() || null;

  if (applyAsOrgId) {
    // Apply as org: caller must be org member (owner/admin)
    const { data: member } = await service
      .from("org_members")
      .select("org_id")
      .eq("org_id", applyAsOrgId)
      .eq("user_id", user.id)
      .in("role", ["owner", "admin"])
      .maybeSingle();
    if (!member) {
      return NextResponse.json({ error: "Not an admin of this org" }, { status: 403 });
    }
    const { data: org } = await service.from("orgs").select("org_type").eq("id", applyAsOrgId).maybeSingle();
    if (!org || (org as { org_type: string }).org_type !== "agency") {
      return NextResponse.json({ error: "Only agencies can apply to gigs" }, { status: 400 });
    }
    const { data: app, error: insertErr } = await service.from("applications").insert({
      job_id: jobId,
      applicant_type: "org",
      applicant_profile_id: null,
      applicant_org_id: applyAsOrgId,
      message: body.message?.trim() || null,
      status: "pending",
      shared_analytics: false,
      analytics_snapshot_json: null,
      shared_cv: false,
      cv_file_path: null,
    }).select("id").single();
    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, applicationId: (app as { id: string }).id });
  }

  // Apply as profile
  const { data: profile } = await service
    .from("profiles")
    .select("id, share_analytics_on_apply, share_cv_on_apply, cv_document_id")
    .eq("id", user.id)
    .maybeSingle();

  let sharedAnalytics = false;
  let analyticsSnapshotJson: Record<string, unknown> | null = null;
  let sharedCv = false;
  let cvFilePath: string | null = null;

  if (profile && (profile as { share_analytics_on_apply?: boolean }).share_analytics_on_apply !== false) {
    const { data: rollup } = await service
      .from("x_analytics_rollups")
      .select("*")
      .eq("profile_id", user.id)
      .maybeSingle();
    if (rollup) {
      sharedAnalytics = true;
      analyticsSnapshotJson = rollup as unknown as Record<string, unknown>;
    }
  }
  if (profile && (profile as { share_cv_on_apply?: boolean }).share_cv_on_apply !== false) {
    const docId = (profile as { cv_document_id?: string | null }).cv_document_id;
    if (docId) {
      const { data: doc } = await service
        .from("profile_documents")
        .select("file_path")
        .eq("id", docId)
        .eq("profile_id", user.id)
        .maybeSingle();
      const path = (doc as { file_path?: string } | null)?.file_path;
      if (path) {
        sharedCv = true;
        cvFilePath = path;
      }
    }
  }

  const { data: app, error: insertErr } = await service.from("applications").insert({
    job_id: jobId,
    applicant_type: "profile",
    applicant_profile_id: user.id,
    applicant_org_id: null,
    message: body.message?.trim() || null,
    status: "pending",
    shared_analytics: sharedAnalytics,
    analytics_snapshot_json: analyticsSnapshotJson,
    shared_cv: sharedCv,
    cv_file_path: cvFilePath,
  }).select("id").single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  const applicationId = (app as { id: string }).id;
  try {
    const { data: orgAdmins } = await service.from("org_members").select("user_id").eq("org_id", (job as { org_id: string }).org_id).in("role", ["owner", "admin"]);
    const { createNotification } = await import("@/lib/notifications");
    for (const m of orgAdmins ?? []) {
      const uid = (m as { user_id: string }).user_id;
      if (uid && uid !== user.id) await createNotification(uid, "application_submitted", { entity_type: "application", entity_id: applicationId, payload: { job_id: jobId } });
    }
  } catch (_) {
    /* non-blocking */
  }
  return NextResponse.json({ ok: true, applicationId });
}
