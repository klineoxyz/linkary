/**
 * POST /api/gigs — create a gig (project/company only)
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const GIG_TYPES = ["ambassador", "affiliate", "ugc", "marketing", "partnership", "other"] as const;
const COMP_TYPES = ["paid", "revshare", "token", "equity", "unpaid", "other"] as const;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const ownerProfileId = getProfileIdForAuthUser(user.id);

  const { data: profile } = await supabase.from("profiles").select("profile_type").eq("id", ownerProfileId).maybeSingle();
  const profileType = (profile as { profile_type?: string } | null)?.profile_type;
  if (profileType !== "project" && profileType !== "company") {
    return fail("FORBIDDEN", "Only projects and companies can create gigs", 403);
  }

  let body: { title?: string; description?: string; gig_type?: string; compensation_type?: string; budget_text?: string | null; location?: string | null; remote?: boolean; is_public?: boolean };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  if (!title || !description) return fail("BAD_REQUEST", "title and description required", 400);

  const gig_type = typeof body?.gig_type === "string" && GIG_TYPES.includes(body.gig_type as typeof GIG_TYPES[number]) ? body.gig_type : "other";
  const compensation_type = typeof body?.compensation_type === "string" && COMP_TYPES.includes(body.compensation_type as typeof COMP_TYPES[number]) ? body.compensation_type : "other";
  const budget_text = typeof body?.budget_text === "string" ? body.budget_text.trim() || null : null;
  const location = typeof body?.location === "string" ? body.location.trim() || null : null;
  const remote = typeof body?.remote === "boolean" ? body.remote : true;
  const is_public = typeof body?.is_public === "boolean" ? body.is_public : true;

  const { data: row, error } = await supabase
    .from("gigs")
    .insert({
      owner_profile_id: ownerProfileId,
      title,
      description,
      gig_type,
      compensation_type,
      budget_text,
      location,
      remote,
      is_public,
      status: "open",
      updated_at: new Date().toISOString(),
    })
    .select("id, owner_profile_id, title, description, gig_type, compensation_type, budget_text, location, remote, is_public, status, created_at, updated_at")
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ gig: row });
}
