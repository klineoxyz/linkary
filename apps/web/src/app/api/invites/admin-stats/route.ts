/**
 * GET /api/invites/admin-stats — admin only. Lightweight ops counts for first-cohort operations.
 * Returns: invite code summary, creator_program_invites by status, open jobs with zero applicants.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY ?? null;
const ADMIN_TWITTER = "muazxinthi";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("Invalid session", 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("twitter_username")
    .eq("id", user.id)
    .maybeSingle();
  const twitter = ((profile as { twitter_username?: string | null })?.twitter_username ?? "")
    .replace(/^@/, "")
    .toLowerCase();
  if (twitter !== ADMIN_TWITTER) return fail("Forbidden", 403);

  if (!serviceKey) return NextResponse.json({ invite_codes: {}, creator_invites: {}, jobs_zero_applicants: 0 });
  const service = createClient(supabaseUrl, serviceKey);

  const statuses = ["available", "redeemed", "revoked", "expired", "reserved"];
  const invite_codes: Record<string, number> = {};
  for (const status of statuses) {
    const { count } = await service.from("invite_codes").select("id", { count: "exact", head: true }).eq("status", status);
    invite_codes[status] = count ?? 0;
  }

  const inviteStatuses = ["invited", "accepted", "declined", "applied", "active", "removed"];
  const creator_invites: Record<string, number> = {};
  for (const st of inviteStatuses) {
    const { count } = await service.from("creator_program_invites").select("id", { count: "exact", head: true }).eq("status", st);
    creator_invites[st] = count ?? 0;
  }

  const { data: openJobs } = await service.from("jobs").select("id").eq("status", "open");
  const jobIds = (openJobs ?? []).map((j: { id: string }) => j.id);
  let jobs_zero_applicants = 0;
  if (jobIds.length > 0) {
    const { data: appCounts } = await service.from("applications").select("job_id").in("job_id", jobIds);
    const countByJob: Record<string, number> = {};
    for (const a of appCounts ?? []) {
      const jid = (a as { job_id: string }).job_id;
      countByJob[jid] = (countByJob[jid] ?? 0) + 1;
    }
    jobs_zero_applicants = jobIds.filter((id) => (countByJob[id] ?? 0) === 0).length;
  }

  return NextResponse.json({
    invite_codes,
    creator_invites,
    jobs_zero_applicants,
    open_jobs_total: jobIds.length,
  });
}
