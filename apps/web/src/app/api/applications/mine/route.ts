/**
 * GET /api/applications/mine — list my applications (as applicant)
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const applicantProfileId = getProfileIdForAuthUser(user.id);

  const { data: rows, error } = await supabase
    .from("gig_applications")
    .select("id, gig_id, applicant_profile_id, message, case_study_ids, status, created_at, updated_at")
    .eq("applicant_profile_id", applicantProfileId)
    .order("created_at", { ascending: false });

  if (error) return fail("DB_ERROR", error.message, 500);
  const applications = (rows ?? []) as Array<{ gig_id: string; [k: string]: unknown }>;

  const gigIds = [...new Set(applications.map((a) => a.gig_id))];
  let gigsById: Record<string, { id: string; title: string; owner_profile_id: string; status: string }> = {};
  if (gigIds.length > 0) {
    const { data: gigs } = await supabase.from("gigs").select("id, title, owner_profile_id, status").in("id", gigIds);
    for (const g of (gigs ?? []) as Array<{ id: string; title: string; owner_profile_id: string; status: string }>) {
      gigsById[g.id] = g;
    }
  }

  const ownerIds = [...new Set(Object.values(gigsById).map((g) => g.owner_profile_id))];
  let ownerById: Record<string, { username: string | null; display_name: string | null }> = {};
  if (ownerIds.length > 0) {
    const { data: profs } = await supabase.from("public_profile_view").select("id, username, display_name").in("id", ownerIds);
    for (const p of (profs ?? []) as Array<{ id: string; username: string | null; display_name: string | null }>) {
      ownerById[p.id] = { username: p.username, display_name: p.display_name };
    }
  }

  const list = applications.map((a) => {
    const gig = gigsById[a.gig_id];
    const owner = gig ? ownerById[gig.owner_profile_id] : null;
    return {
      ...a,
      gig: gig ? { ...gig, owner } : null,
    };
  });

  return ok({ applications: list });
}
