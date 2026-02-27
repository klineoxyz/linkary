/**
 * GET /api/collab-requests/inbox — list requests where target_profile_id = current user (newest first)
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

  const targetProfileId = getProfileIdForAuthUser(user.id);

  const { data: rows, error } = await supabase
    .from("collab_requests")
    .select("id, created_at, requester_profile_id, message, category, budget_text, status, seen_at, reply_note, requester_followup_note")
    .eq("target_profile_id", targetProfileId)
    .order("created_at", { ascending: false });

  if (error) return fail("DB_ERROR", error.message, 500);

  const requests = (rows ?? []) as Array<{
    id: string;
    created_at: string;
    requester_profile_id: string;
    message: string;
    category: string | null;
    budget_text: string | null;
    status: string;
    seen_at: string | null;
    reply_note: string | null;
    requester_followup_note: string | null;
  }>;

  const requesterIds = [...new Set(requests.map((r) => r.requester_profile_id))];
  let requesterById: Record<string, { username: string | null; display_name: string | null; avatar_url: string | null }> = {};
  if (requesterIds.length > 0) {
    const { data: profs } = await supabase
      .from("public_profile_view")
      .select("id, username, display_name, avatar_url")
      .in("id", requesterIds);
    for (const p of (profs ?? []) as Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null }>) {
      requesterById[p.id] = { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url };
    }
  }

  const list = requests.map((r) => ({
    ...r,
    requester: requesterById[r.requester_profile_id] ?? null,
  }));

  let mySocials: { x_url: string | null; telegram_url: string | null; website_url: string | null } = { x_url: null, telegram_url: null, website_url: null };
  const { data: socialRow } = await supabase
    .from("profile_socials")
    .select("x_url, telegram_url, website_url")
    .eq("profile_id", targetProfileId)
    .maybeSingle();
  if (socialRow) {
    const s = socialRow as { x_url?: string | null; telegram_url?: string | null; website_url?: string | null };
    mySocials = { x_url: s.x_url ?? null, telegram_url: s.telegram_url ?? null, website_url: s.website_url ?? null };
  }

  return ok({ requests: list, my_socials: mySocials });
}
