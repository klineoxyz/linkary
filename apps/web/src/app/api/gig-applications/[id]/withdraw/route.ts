/**
 * POST /api/gig-applications/[id]/withdraw — applicant withdraws (sets status to withdrawn)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function assertApplicant(supabase: SupabaseClient, applicationId: string, applicantProfileId: string): Promise<NextResponse | null> {
  const { data, error } = await supabase
    .from("gig_applications")
    .select("id, applicant_profile_id, status")
    .eq("id", applicationId)
    .maybeSingle();
  if (error) return fail("DB_ERROR", error.message, 500);
  const row = data as { applicant_profile_id: string; status: string } | null;
  if (!row) return fail("NOT_FOUND", "Application not found", 404);
  if (row.applicant_profile_id !== applicantProfileId) return fail("FORBIDDEN", "Not your application", 403);
  if (row.status !== "submitted") return fail("BAD_REQUEST", "Can only withdraw submitted applications", 400);
  return null;
}

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authHeader = _request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const { id } = await params;
  if (!id) return fail("BAD_REQUEST", "id required", 400);
  const applicantProfileId = getProfileIdForAuthUser(user.id);
  const err = await assertApplicant(supabase, id, applicantProfileId);
  if (err) return err;

  const { data: row, error } = await supabase
    .from("gig_applications")
    .update({ status: "withdrawn", updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ application: row });
}
