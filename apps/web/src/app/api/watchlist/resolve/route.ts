/**
 * GET /api/watchlist/resolve?entity_type=profile&username=alice | entity_type=org&slug=acme
 * Returns { entity_id: uuid } for a published profile (by username) or org (by slug) so the client can call toggle.
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

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entity_type");
  const username = searchParams.get("username")?.trim();
  const slug = searchParams.get("slug")?.trim();

  if (entityType === "profile" && username) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const norm = username.toLowerCase().replace(/^@/, "");
    const { data } = await supabase
      .from("public_profile_view")
      .select("id")
      .or(`username.ilike.${norm},twitter_username.ilike.${norm}`)
      .maybeSingle();
    if (data && (data as { id: string }).id) {
      return ok({ entity_id: (data as { id: string }).id });
    }
    return fail("NOT_FOUND", "Profile not found", 404);
  }

  if (entityType === "org" && slug) {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data } = await supabase
      .from("public_org_view")
      .select("id")
      .ilike("slug", slug)
      .maybeSingle();
    if (data && (data as { id: string }).id) {
      return ok({ entity_id: (data as { id: string }).id });
    }
    return fail("NOT_FOUND", "Org not found", 404);
  }

  return fail("BAD_REQUEST", "entity_type=profile&username=... or entity_type=org&slug=... required", 400);
}
