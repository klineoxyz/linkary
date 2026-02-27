/**
 * GET /api/collab-requests/sent — list requests where requester_profile_id = current user (newest first)
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

  const requesterProfileId = getProfileIdForAuthUser(user.id);

  const { data: rows, error } = await supabase
    .from("collab_requests")
    .select("id, created_at, target_profile_id, message, category, budget_text, status, reply_note, requester_followup_note")
    .eq("requester_profile_id", requesterProfileId)
    .order("created_at", { ascending: false });

  if (error) return fail("DB_ERROR", error.message, 500);

  const requests = (rows ?? []) as Array<{
    id: string;
    created_at: string;
    target_profile_id: string;
    message: string;
    category: string | null;
    budget_text: string | null;
    status: string;
    reply_note: string | null;
    requester_followup_note: string | null;
  }>;

  const targetIds = [...new Set(requests.map((r) => r.target_profile_id))];
  let targetById: Record<string, { username: string | null; display_name: string | null; avatar_url: string | null; x_url?: string | null; telegram_url?: string | null; website_url?: string | null }> = {};
  if (targetIds.length > 0) {
    const [profsRes, socialsRes] = await Promise.all([
      supabase.from("public_profile_view").select("id, username, display_name, avatar_url").in("id", targetIds),
      supabase.from("profile_socials").select("profile_id, x_url, telegram_url, website_url").in("profile_id", targetIds),
    ]);
    for (const p of (profsRes.data ?? []) as Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null }>) {
      targetById[p.id] = { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url };
    }
    for (const s of (socialsRes.data ?? []) as Array<{ profile_id: string; x_url?: string | null; telegram_url?: string | null; website_url?: string | null }>) {
      if (targetById[s.profile_id]) {
        targetById[s.profile_id] = {
          ...targetById[s.profile_id],
          x_url: s.x_url ?? null,
          telegram_url: s.telegram_url ?? null,
          website_url: s.website_url ?? null,
        };
      }
    }
  }

  const list = requests.map((r) => ({
    ...r,
    target: targetById[r.target_profile_id] ?? null,
  }));

  return ok({ requests: list });
}
