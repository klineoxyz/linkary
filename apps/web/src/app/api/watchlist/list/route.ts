/**
 * GET /api/watchlist/list
 * Returns current user's watchlist grouped by People (profile) and Orgs (org).
 * Each item includes entity_type, entity_id, and resolved display fields (username/slug, name, avatar/logo) from public views.
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
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  const { data: rows } = await supabase
    .from("watchlists")
    .select("entity_type, entity_id, created_at")
    .eq("owner_profile_id", user.id)
    .order("created_at", { ascending: false });

  const list = (rows ?? []) as Array<{ entity_type: string; entity_id: string; created_at: string }>;
  const profileIds = list.filter((r) => r.entity_type === "profile").map((r) => r.entity_id);
  const orgIds = list.filter((r) => r.entity_type === "org").map((r) => r.entity_id);

  let people: Array<{ entity_type: "profile"; entity_id: string; username: string | null; display_name: string | null; avatar_url: string | null; created_at: string }> = [];
  let orgs: Array<{ entity_type: "org"; entity_id: string; slug: string | null; name: string | null; logo_url: string | null; created_at: string }> = [];

  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("public_profile_view")
      .select("id, username, display_name, avatar_url")
      .in("id", profileIds);
    type ProfileRow = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };
    const byId = new Map<string, ProfileRow>(((profiles ?? []) as ProfileRow[]).map((p) => [p.id, p]));
    people = list
      .filter((r) => r.entity_type === "profile")
      .map((r) => {
        const p = byId.get(r.entity_id);
        return {
          entity_type: "profile" as const,
          entity_id: r.entity_id,
          username: p?.username ?? null,
          display_name: p?.display_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          created_at: r.created_at,
        };
      });
  }

  if (orgIds.length > 0) {
    const { data: orgRows } = await supabase
      .from("public_org_view")
      .select("id, slug, name, logo_url")
      .in("id", orgIds);
    type OrgRow = { id: string; slug: string | null; name: string | null; logo_url: string | null };
    const orgById = new Map<string, OrgRow>(((orgRows ?? []) as OrgRow[]).map((o) => [o.id, o]));
    orgs = list
      .filter((r) => r.entity_type === "org")
      .map((r) => {
        const o = orgById.get(r.entity_id);
        return {
          entity_type: "org" as const,
          entity_id: r.entity_id,
          slug: o?.slug ?? null,
          name: o?.name ?? null,
          logo_url: o?.logo_url ?? null,
          created_at: r.created_at,
        };
      });
  }

  return ok({ people, orgs });
}
