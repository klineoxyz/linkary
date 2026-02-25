/**
 * POST /api/watchlist/toggle
 * Body: { entity_type: "profile" | "org", entity_id: string (uuid) }
 * Toggles watchlist entry: insert if missing, delete if present. Returns { onWatchlist: boolean }.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

  let body: { entity_type?: string; entity_id?: string };
  try {
    body = await request.json();
  } catch {
    return fail("BAD_REQUEST", "Invalid JSON", 400);
  }

  const entityType = body?.entity_type === "profile" || body?.entity_type === "org" ? body.entity_type : null;
  const entityId = typeof body?.entity_id === "string" ? body.entity_id.trim() : null;
  if (!entityType || !entityId) {
    return fail("BAD_REQUEST", "entity_type (profile|org) and entity_id (uuid) are required", 400);
  }

  const { data: existing } = await supabase
    .from("watchlists")
    .select("id")
    .eq("owner_profile_id", user.id)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("watchlists")
      .delete()
      .eq("owner_profile_id", user.id)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);
    return ok({ onWatchlist: false });
  }

  const { error: insertErr } = await supabase.from("watchlists").insert({
    owner_profile_id: user.id,
    entity_type: entityType,
    entity_id: entityId,
  });
  if (insertErr) {
    if (insertErr.code === "23503") return fail("BAD_REQUEST", "Invalid entity_id (profile or org not found)", 400);
    return fail("INTERNAL", insertErr.message, 500);
  }
  return ok({ onWatchlist: true });
}
