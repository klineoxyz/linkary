/**
 * GET /api/gigs/[id]/applications — list applications for a gig (owner only). Returns applicants with profile + case study basics.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function assertOwner(supabase: SupabaseClient, gigId: string, ownerProfileId: string): Promise<NextResponse | null> {
  const { data, error } = await supabase.from("gigs").select("owner_profile_id").eq("id", gigId).maybeSingle();
  if (error) return fail("DB_ERROR", error.message, 500);
  const row = data as { owner_profile_id: string } | null;
  if (!row) return fail("NOT_FOUND", "Gig not found", 404);
  if (row.owner_profile_id !== ownerProfileId) return fail("FORBIDDEN", "Not your gig", 403);
  return null;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authHeader = _request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const { id: gigId } = await params;
  if (!gigId) return fail("BAD_REQUEST", "id required", 400);
  const ownerProfileId = getProfileIdForAuthUser(user.id);
  const err = await assertOwner(supabase, gigId, ownerProfileId);
  if (err) return err;

  const { data: rows, error } = await supabase
    .from("gig_applications")
    .select("id, gig_id, applicant_profile_id, message, case_study_ids, status, created_at, updated_at")
    .eq("gig_id", gigId)
    .order("created_at", { ascending: false });

  if (error) return fail("DB_ERROR", error.message, 500);
  const applications = (rows ?? []) as Array<{
    id: string;
    applicant_profile_id: string;
    message: string | null;
    case_study_ids: string[];
    status: string;
    created_at: string;
    [k: string]: unknown;
  }>;

  const applicantIds = [...new Set(applications.map((a) => a.applicant_profile_id))];
  const caseIds = applications.flatMap((a) => (Array.isArray(a.case_study_ids) ? a.case_study_ids : []));
  const uniqueCaseIds = [...new Set(caseIds)];

  let profilesById: Record<string, { id: string; username: string | null; display_name: string | null; avatar_url: string | null; profile_type: string | null }> = {};
  if (applicantIds.length > 0) {
    const { data: profs } = await supabase.from("public_profile_view").select("id, username, display_name, avatar_url, profile_type").in("id", applicantIds);
    for (const p of (profs ?? []) as Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null; profile_type: string | null }>) {
      profilesById[p.id] = p;
    }
  }

  let caseStudiesById: Record<string, { id: string; title: string | null; proof_url: string | null }> = {};
  if (uniqueCaseIds.length > 0) {
    const { data: cases } = await supabase.from("case_studies").select("id, title, proof_url").in("id", uniqueCaseIds);
    for (const c of (cases ?? []) as Array<{ id: string; title: string | null; proof_url: string | null }>) {
      caseStudiesById[c.id] = c;
    }
  }

  const list = applications.map((a) => {
    const profile = profilesById[a.applicant_profile_id];
    const case_studies = (Array.isArray(a.case_study_ids) ? a.case_study_ids : []).map((cid) => caseStudiesById[cid]).filter(Boolean);
    return {
      id: a.id,
      gig_id: a.gig_id,
      applicant_profile_id: a.applicant_profile_id,
      message: a.message,
      case_study_ids: a.case_study_ids,
      status: a.status,
      created_at: a.created_at,
      updated_at: (a as { updated_at?: string }).updated_at,
      applicant: profile
        ? { id: profile.id, username: profile.username, display_name: profile.display_name, avatar_url: profile.avatar_url, profile_type: profile.profile_type }
        : null,
      case_studies,
    };
  });

  return ok({ applications: list });
}
