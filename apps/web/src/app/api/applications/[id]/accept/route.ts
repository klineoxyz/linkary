import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** POST: Org owner/admin accepts application and creates a deal. */
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
    .select("id, org_id, status, title, type, objective, links, promoted_org_id, required_platforms, promoted_social_handles, weekly_required_posts, daily_engagement_required")
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
    return NextResponse.json({ error: "Only org owner or admin can accept" }, { status: 403 });
  }

  const profileId =
    app.applicant_type === "profile" ? app.applicant_profile_id : null;
  const applicantOrgId =
    app.applicant_type === "org" ? app.applicant_org_id : null;

  if (app.applicant_type === "profile" && profileId) {
    const { data: deal, error: dealErr } = await supabase
      .from("deals")
      .insert({
        profile_id: profileId,
        org_id: job.org_id,
        job_id: job.id,
        application_id: app.id,
        status: "active",
      })
      .select("id, profile_id, org_id, job_id, status")
      .single();

    if (dealErr) {
      return NextResponse.json({ error: dealErr.message }, { status: 500 });
    }

    await supabase
      .from("applications")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", applicationId);
    await supabase
      .from("jobs")
      .update({ status: "accepted", updated_at: new Date().toISOString() })
      .eq("id", job.id);

    try {
      const { createNotification } = await import("@/lib/notifications");
      await createNotification(profileId, "application_accepted", { entity_type: "application", entity_id: applicationId, payload: { job_id: job.id, org_id: job.org_id } });
    } catch (_) {
      /* non-blocking */
    }
    try {
      const { triggerLinkaryCrmSync } = await import("@/lib/crm-sync");
      const jobTitle = (job as { title?: string }).title?.trim() || "Deliverables";
      const j = job as {
        id: string; org_id: string; title?: string;
        objective?: string | null; links?: Array<{ label?: string; url: string }>;
        promoted_org_id?: string | null; required_platforms?: string[] | null;
        promoted_social_handles?: Array<{ platform: string; handle: string }> | null;
        weekly_required_posts?: number | null; daily_engagement_required?: string | null;
      };
      await triggerLinkaryCrmSync({
        org_id: j.org_id,
        source_linkary_campaign_id: j.id,
        campaign_title: jobTitle,
        participant_profile_id: profileId,
        tasks: [{ linkary_task_id: j.id, title: jobTitle }],
        campaign_definition: (j.objective != null || (j.links?.length ?? 0) > 0 || j.promoted_org_id || (j.required_platforms?.length ?? 0) > 0 || (j.promoted_social_handles?.length ?? 0) > 0 || j.weekly_required_posts != null || j.daily_engagement_required)
          ? {
              objective: j.objective ?? null,
              links: j.links ?? [],
              promoted_org_id: j.promoted_org_id ?? null,
              required_platforms: j.required_platforms ?? null,
              promoted_social_handles: j.promoted_social_handles ?? null,
              weekly_required_posts: j.weekly_required_posts ?? null,
              daily_engagement_required: j.daily_engagement_required ?? null,
            }
          : undefined,
      });
    } catch (_) {
      /* non-blocking; sync failure does not fail acceptance */
    }
    return NextResponse.json({ ok: true, deal });
  }

  if (app.applicant_type === "org" && applicantOrgId) {
    return NextResponse.json(
      { error: "Accepting agency applications not yet supported; deal creation for org applicant requires a designated profile" },
      { status: 501 }
    );
  }

  return NextResponse.json({ error: "Invalid application applicant" }, { status: 400 });
}
