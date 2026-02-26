/**
 * PATCH /api/gig-applications/[id]/status — owner sets accepted/rejected. Body: { status: 'accepted' | 'rejected' }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type AppRow = { id: string; gig_id: string; applicant_profile_id: string };

async function assertOwnerOfGig(supabase: SupabaseClient, applicationId: string, ownerProfileId: string): Promise<{ app: AppRow; gigId: string } | NextResponse> {
  const { data: app, error: appErr } = await supabase
    .from("gig_applications")
    .select("id, gig_id, applicant_profile_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (appErr || !app) return fail("NOT_FOUND", "Application not found", 404);
  const { data: gig, error: gigErr } = await supabase
    .from("gigs")
    .select("owner_profile_id")
    .eq("id", (app as AppRow).gig_id)
    .maybeSingle();
  if (gigErr || !gig) return fail("NOT_FOUND", "Gig not found", 404);
  if ((gig as { owner_profile_id: string }).owner_profile_id !== ownerProfileId) return fail("FORBIDDEN", "Not your gig", 403);
  return { app: app as AppRow, gigId: (app as AppRow).gig_id };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const { id } = await params;
  if (!id) return fail("BAD_REQUEST", "id required", 400);
  const ownerProfileId = getProfileIdForAuthUser(user.id);
  const assertResult = await assertOwnerOfGig(supabase, id, ownerProfileId);
  if (assertResult instanceof NextResponse) return assertResult;
  const { app, gigId } = assertResult;

  let body: { status?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const status = typeof body?.status === "string" ? body.status.toLowerCase() : "";
  if (status !== "accepted" && status !== "rejected") return fail("BAD_REQUEST", "status must be accepted or rejected", 400);

  const { data: row, error } = await supabase
    .from("gig_applications")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);

  let dealCreated = false;
  if (status === "accepted") {
    const { error: dealErr } = await supabase.from("gig_deals").insert({
      gig_id: gigId,
      owner_profile_id: ownerProfileId,
      participant_profile_id: app.applicant_profile_id,
      status: "active",
    });
    dealCreated = !dealErr;
  }

  return ok({ application: row, dealCreated });
}
