/**
 * GET: List org team members for a profile (owner only). Query: profileId=uuid
 * POST: Create a team member (owner only; profile must be profile_type=company).
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
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  const profileId = getProfileIdForAuthUser(user.id);

  const { searchParams } = new URL(request.url);
  const requestedProfileId = searchParams.get("profileId")?.trim();
  if (!requestedProfileId) {
    return fail("BAD_REQUEST", "profileId is required", 400);
  }
  if (requestedProfileId !== profileId) {
    return fail("FORBIDDEN", "You can only list your own profile's team.", 403);
  }

  const { data: rows, error } = await supabase
    .from("org_team_members")
    .select("id, name, role, avatar_url, linkedin_url, x_url, website_url, is_public, sort_order, created_at, updated_at")
    .eq("org_profile_id", profileId)
    .order("sort_order", { ascending: true });

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ team: rows ?? [] });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  let body: {
    name?: string;
    role?: string | null;
    avatar_url?: string | null;
    linkedin_url?: string | null;
    x_url?: string | null;
    website_url?: string | null;
    is_public?: boolean;
  };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return fail("BAD_REQUEST", "name is required", 400);

  const profileId = getProfileIdForAuthUser(user.id);

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, profile_type")
    .eq("id", profileId)
    .maybeSingle();
  const p = profile as { id: string; profile_type?: string } | null;
  if (!p) return fail("NOT_FOUND", "Profile not found", 404);
  if (p.profile_type !== "company") {
    return fail("BAD_REQUEST", "Team is only available for company profiles. Set profile type to Company first.", 400);
  }

  const { data: maxOrder } = await supabase
    .from("org_team_members")
    .select("sort_order")
    .eq("org_profile_id", profileId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxOrder as { sort_order?: number } | null)?.sort_order ?? -1;
  const sort_order = nextOrder + 1;

  const insert: Record<string, unknown> = {
    org_profile_id: profileId,
    name,
    role: typeof body?.role === "string" ? body.role.trim() || null : null,
    avatar_url: typeof body?.avatar_url === "string" ? body.avatar_url.trim() || null : null,
    linkedin_url: typeof body?.linkedin_url === "string" ? body.linkedin_url.trim() || null : null,
    x_url: typeof body?.x_url === "string" ? body.x_url.trim() || null : null,
    website_url: typeof body?.website_url === "string" ? body.website_url.trim() || null : null,
    is_public: typeof body?.is_public === "boolean" ? body.is_public : true,
    sort_order,
  };

  const { data: row, error } = await supabase
    .from("org_team_members")
    .insert(insert)
    .select("id, name, role, avatar_url, linkedin_url, x_url, website_url, is_public, sort_order, created_at, updated_at")
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ member: row });
}
