/**
 * POST /api/orgs/[orgId]/job-invites — body: { job_id, profile_id, kol_list_id? }
 * Org members only; job must belong to org.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

  let body: { job_id?: string; profile_id?: string; kol_list_id?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const jobId = body.job_id?.trim();
  const profileId = body.profile_id?.trim();
  if (!jobId || !profileId) {
    return NextResponse.json({ error: "job_id and profile_id required" }, { status: 400 });
  }

  const { data: job, error: je } = await supabase
    .from("jobs")
    .select("id, org_id, title")
    .eq("id", jobId)
    .maybeSingle();
  if (je || !job) return NextResponse.json({ error: "Job not found" }, { status: 404 });
  const j = job as { id: string; org_id: string; title: string };
  if (j.org_id !== orgId) {
    return NextResponse.json({ error: "Job does not belong to this org" }, { status: 403 });
  }

  let kolListId: string | null = null;
  if (body.kol_list_id && typeof body.kol_list_id === "string") {
    const { data: kl } = await supabase
      .from("kol_lists")
      .select("id, owner_type, owner_id")
      .eq("id", body.kol_list_id)
      .maybeSingle();
    const k = kl as { owner_type?: string; owner_id?: string } | null;
    if (k?.owner_type === "org" && k.owner_id === orgId) kolListId = body.kol_list_id;
  }

  const { data: row, error } = await supabase
    .from("org_job_invites")
    .insert({
      org_id: orgId,
      job_id: jobId,
      profile_id: profileId,
      kol_list_id: kolListId,
    })
    .select("id, job_id, profile_id, invited_at, kol_list_id")
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already invited to this job", code: "DUPLICATE" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ invite: row, job_title: j.title });
}
