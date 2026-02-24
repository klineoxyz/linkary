import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
const BUCKET = "profile-documents";

/** GET: Org admin gets signed download URL for applicant CV when shared_cv=true. */
export async function GET(
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
    .select("id, job_id, shared_cv, cv_file_path")
    .eq("id", applicationId)
    .maybeSingle();

  if (appErr || !app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  if (!(app as { shared_cv?: boolean }).shared_cv || !(app as { cv_file_path?: string | null }).cv_file_path) {
    return NextResponse.json({ error: "CV not shared for this application" }, { status: 403 });
  }

  const { data: job } = await supabase
    .from("jobs")
    .select("org_id")
    .eq("id", (app as { job_id: string }).job_id)
    .maybeSingle();
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", (job as { org_id: string }).org_id)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership || !["owner", "admin"].includes((membership as { role: string }).role)) {
    return NextResponse.json({ error: "Only org owner or admin can download CV" }, { status: 403 });
  }

  const filePath = (app as { cv_file_path: string }).cv_file_path;
  if (!serviceKey) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  const service = createClient(supabaseUrl, serviceKey);
  const { data: signed, error } = await service.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ url: signed.signedUrl });
}
