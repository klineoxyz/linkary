/**
 * GET: List my profile skills (ordered).
 * POST: Create a profile skill.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const NAME_MAX = 40;
const LEVEL_MIN = 1;
const LEVEL_MAX = 5;

export async function GET(_request: NextRequest) {
  const authHeader = _request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const profileId = getProfileIdForAuthUser(user.id);

  const { data: rows, error } = await supabase
    .from("profile_skills")
    .select("id, name, level, is_public, sort_order, created_at")
    .eq("profile_id", profileId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ skills: rows ?? [] });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const profileId = getProfileIdForAuthUser(user.id);

  let body: { name?: string; level?: number; is_public?: boolean };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const name = typeof body?.name === "string" ? body.name.trim().slice(0, NAME_MAX) : "";
  if (!name) return fail("BAD_REQUEST", "name is required (max 40 characters)", 400);

  let level: number | null = null;
  if (typeof body?.level === "number" && Number.isFinite(body.level)) {
    const n = Math.round(body.level);
    if (n >= LEVEL_MIN && n <= LEVEL_MAX) level = n;
  } else if (body?.level != null) {
    const n = Number(body.level);
    if (Number.isFinite(n) && n >= LEVEL_MIN && n <= LEVEL_MAX) level = Math.round(n);
  }

  const is_public = typeof body?.is_public === "boolean" ? body.is_public : true;

  const { data: row, error } = await supabase
    .from("profile_skills")
    .insert({ profile_id: profileId, name, level, is_public })
    .select("id, name, level, is_public, sort_order, created_at")
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ skill: row });
}
