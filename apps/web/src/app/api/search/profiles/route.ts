/**
 * GET /api/search/profiles?q=...
 * Returns top 10 profile matches (id, username, display_name, avatar_url, profile_type).
 * Auth required. Searches public_profile_view (published profiles with username).
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";

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
  const { error: userError } = await supabase.auth.getUser(token);
  if (userError) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return ok({ profiles: [] });
  }

  const safe = q.replace(/\*/g, "");
  const { data: rows, error } = await supabase
    .from("public_profile_view")
    .select("id, username, display_name, avatar_url, profile_type")
    .or(`username.ilike.*${safe}*,display_name.ilike.*${safe}*,twitter_username.ilike.*${safe}*`)
    .limit(10);

  if (error) return fail("DB_ERROR", error.message, 500);

  const profiles = (rows ?? []).map((r: { id: string; username: string | null; display_name: string | null; avatar_url: string | null; profile_type: string | null }) => ({
    id: r.id,
    username: r.username ?? null,
    display_name: r.display_name ?? null,
    avatar_url: r.avatar_url ?? null,
    profile_type: r.profile_type ?? "individual",
  }));

  return ok({ profiles });
}
