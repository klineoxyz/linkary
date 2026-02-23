/**
 * POST /api/orgs/[orgId]/follow
 * Current user (profile) follows an org. Idempotent: already following returns success.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ orgId: string }> }
) {
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

  const { orgId } = await context.params;
  if (!orgId) return fail("BAD_REQUEST", "orgId required", 400);

  const { error } = await supabase.from("org_follows").insert({
    follower_profile_id: user.id,
    org_id: orgId,
  }).select("id").single();

  if (error) {
    if (error.code === "23505") return ok({ followed: true, already: true });
    if (error.code === "23503") return fail("NOT_FOUND", "Org not found", 404);
    return fail("INTERNAL", error.message, 500);
  }
  return ok({ followed: true });
}
