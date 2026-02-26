/**
 * GET: List my profile achievements (ordered).
 * POST: Create a profile achievement.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const TITLE_MAX = 80;
const DESCRIPTION_MAX = 280;

function isValidUrl(s: string): boolean {
  const t = s.trim();
  return t.startsWith("https://") || t.startsWith("http://");
}

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
    .from("profile_achievements")
    .select("id, title, description, proof_url, is_public, sort_order, created_at")
    .eq("profile_id", profileId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return fail("DB_ERROR", error.message, 500);
  const list = (rows ?? []).map((r: { proof_url?: string | null }) => ({
    ...r,
    url: r.proof_url ?? null,
  }));
  return ok({ achievements: list });
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

  let body: { title?: string; description?: string | null; url?: string | null; is_public?: boolean };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const title = typeof body?.title === "string" ? body.title.trim().slice(0, TITLE_MAX) : "";
  if (!title) return fail("BAD_REQUEST", "title is required (max 80 characters)", 400);

  const description = typeof body?.description === "string" ? body.description.trim().slice(0, DESCRIPTION_MAX) || null : null;
  let proof_url: string | null = null;
  if (typeof body?.url === "string" && body.url.trim()) {
    const u = body.url.trim();
    if (!isValidUrl(u)) return fail("BAD_REQUEST", "url must start with https:// or http://", 400);
    proof_url = u;
  }

  const is_public = typeof body?.is_public === "boolean" ? body.is_public : true;

  const { data: row, error } = await supabase
    .from("profile_achievements")
    .insert({ profile_id: profileId, title, description, proof_url, is_public })
    .select("id, title, description, proof_url, is_public, sort_order, created_at")
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  const out = { ...row, url: (row as { proof_url?: string | null }).proof_url ?? null };
  return ok({ achievement: out });
}
