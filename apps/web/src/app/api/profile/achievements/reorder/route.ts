/**
 * POST: Reorder profile achievements. Body: { orderedIds: string[] }
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

  let body: { orderedIds?: string[] };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const orderedIds = Array.isArray(body?.orderedIds) ? body.orderedIds.filter((id) => typeof id === "string") : [];
  if (orderedIds.length === 0) return ok({ reordered: true });

  const { data: rows, error: fetchError } = await supabase
    .from("profile_achievements")
    .select("id")
    .eq("profile_id", profileId)
    .in("id", orderedIds);

  if (fetchError) return fail("DB_ERROR", fetchError.message, 500);
  const allowedIds = new Set((rows ?? []).map((r: { id: string }) => r.id));
  if (allowedIds.size !== orderedIds.length) return fail("FORBIDDEN", "Some ids are not yours or not found", 403);

  for (let i = 0; i < orderedIds.length; i++) {
    const { error: updateError } = await supabase
      .from("profile_achievements")
      .update({ sort_order: i, updated_at: new Date().toISOString() })
      .eq("id", orderedIds[i]);
    if (updateError) return fail("DB_ERROR", updateError.message, 500);
  }

  return ok({ reordered: true });
}
