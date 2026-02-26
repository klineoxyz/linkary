/**
 * POST /api/gigs/[id]/apply — apply to a gig (individual). Body: { message?, case_study_ids: [] }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function getGig(supabase: SupabaseClient, gigId: string) {
  const { data, error } = await supabase.from("gigs").select("id, owner_profile_id, status, is_public").eq("id", gigId).maybeSingle();
  if (error) return { error: error.message as string, gig: null };
  return { error: null, gig: data as { id: string; owner_profile_id: string; status: string; is_public: boolean } | null };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const applicantProfileId = getProfileIdForAuthUser(user.id);

  const { id: gigId } = await params;
  if (!gigId) return fail("BAD_REQUEST", "id required", 400);

  const { gig, error: gigErr } = await getGig(supabase, gigId);
  if (gigErr) return fail("DB_ERROR", gigErr, 500);
  if (!gig) return fail("NOT_FOUND", "Gig not found", 404);
  if (gig.status !== "open") return fail("BAD_REQUEST", "Gig is not open for applications", 400);
  if (gig.owner_profile_id === applicantProfileId) return fail("BAD_REQUEST", "Cannot apply to your own gig", 400);

  let body: { message?: string; case_study_ids?: string[] };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const message = typeof body?.message === "string" ? body.message.trim() || null : null;
  const rawIds = Array.isArray(body?.case_study_ids) ? body.case_study_ids : [];
  const case_study_ids = rawIds.filter((id) => typeof id === "string").slice(0, 20);

  const { data: row, error } = await supabase
    .from("gig_applications")
    .insert({
      gig_id: gigId,
      applicant_profile_id: applicantProfileId,
      message,
      case_study_ids,
      status: "submitted",
      updated_at: new Date().toISOString(),
    })
    .select("id, gig_id, applicant_profile_id, message, case_study_ids, status, created_at, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") return fail("BAD_REQUEST", "You have already applied to this gig", 400);
    return fail("DB_ERROR", error.message, 500);
  }
  return ok({ application: row });
}
