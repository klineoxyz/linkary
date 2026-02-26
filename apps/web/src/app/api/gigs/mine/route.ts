/**
 * GET /api/gigs/mine — list gigs owned by current user
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

  const ownerProfileId = getProfileIdForAuthUser(user.id);

  const { data: rows, error } = await supabase
    .from("gigs")
    .select("id, owner_profile_id, title, description, gig_type, compensation_type, budget_text, location, remote, is_public, status, created_at, updated_at")
    .eq("owner_profile_id", ownerProfileId)
    .order("created_at", { ascending: false });

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ gigs: rows ?? [] });
}
