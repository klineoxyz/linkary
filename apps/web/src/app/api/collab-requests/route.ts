/**
 * POST /api/collab-requests — create a collab request (requester → target by username)
 * Body: { target_username, message, category?, budget_text? }
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { getProfileIdForAuthUser } from "@/lib/profiles";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function normalizeUsername(s: string): string {
  return s.trim().toLowerCase().replace(/^@/, "");
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: "Bearer " + token } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("INVALID_SESSION", "Invalid session", 401);

  const requesterProfileId = getProfileIdForAuthUser(user.id);

  let body: { target_username?: string; message?: string; category?: string; budget_text?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const targetUsernameRaw = typeof body?.target_username === "string" ? body.target_username : "";
  const slug = normalizeUsername(targetUsernameRaw);
  if (!slug) return fail("BAD_REQUEST", "target_username is required", 400);

  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return fail("BAD_REQUEST", "message is required", 400);

  const category = typeof body?.category === "string" ? body.category.trim() || null : null;
  const budgetText = typeof body?.budget_text === "string" ? body.budget_text.trim() || null : null;

  const orFilter = "username.ilike." + slug + ",twitter_username.ilike." + slug;
  const { data: targetRow, error: targetErr } = await supabase
    .from("public_profile_view")
    .select("id")
    .or(orFilter)
    .maybeSingle();

  if (targetErr) return fail("DB_ERROR", targetErr.message, 500);
  if (!targetRow?.id) return fail("NOT_FOUND", "Profile not found", 404);

  const targetProfileId = (targetRow as { id: string }).id;
  if (targetProfileId === requesterProfileId) return fail("BAD_REQUEST", "Cannot request collab with yourself", 400);

  const { data: row, error } = await supabase
    .from("collab_requests")
    .insert({
      requester_profile_id: requesterProfileId,
      target_profile_id: targetProfileId,
      message,
      category: category ?? null,
      budget_text: budgetText ?? null,
      status: "new",
    })
    .select("id")
    .single();

  if (error) return fail("DB_ERROR", error.message, 500);
  return ok({ id: (row as { id: string }).id });
}
