/**
 * GET /api/gigs/public — list open public gigs. Query: owner=username (optional), search=..., type=... (gig_type)
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { normalizeIdentifier } from "@/lib/entityResolver";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const GIG_TYPES = ["ambassador", "affiliate", "ugc", "marketing", "partnership", "other"];

export async function GET(request: NextRequest) {
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { searchParams } = new URL(request.url);
  const ownerUsername = searchParams.get("owner")?.trim();
  const search = searchParams.get("search")?.trim();
  const type = searchParams.get("type")?.trim();

  let query = supabase
    .from("gigs")
    .select("id, owner_profile_id, title, description, gig_type, compensation_type, budget_text, location, remote, is_public, status, created_at, updated_at")
    .eq("is_public", true)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(50);

  if (ownerUsername) {
    const norm = normalizeIdentifier(ownerUsername);
    const { data: byUsername } = await supabase.from("public_profile_view").select("id").ilike("username", norm).maybeSingle();
    const { data: byTwitter } = await supabase.from("public_profile_view").select("id").ilike("twitter_username", norm).maybeSingle();
    const profile = (byUsername ?? byTwitter) as { id?: string } | null;
    const profileId = profile?.id;
    if (!profileId) return ok({ gigs: [] });
    query = query.eq("owner_profile_id", profileId);
  }

  if (type && GIG_TYPES.includes(type)) {
    query = query.eq("gig_type", type);
  }

  if (search && search.length >= 2) {
    const safe = search.replace(/,/g, " ").trim();
    if (safe.length >= 2) {
      const term = `%${safe}%`;
      query = query.or(`title.ilike.${term},description.ilike.${term}`);
    }
  }

  const { data: rows, error } = await query;

  if (error) return fail("DB_ERROR", error.message, 500);

  const gigs = rows ?? [];
  const ownerIds = [...new Set((gigs as Array<{ owner_profile_id: string }>).map((g) => g.owner_profile_id))];
  let ownerById: Record<string, { username: string | null; display_name: string | null }> = {};
  if (ownerIds.length > 0) {
    const { data: profs } = await supabase.from("public_profile_view").select("id, username, display_name").in("id", ownerIds);
    for (const p of (profs ?? []) as Array<{ id: string; username: string | null; display_name: string | null }>) {
      ownerById[p.id] = { username: p.username, display_name: p.display_name };
    }
  }

  const list = (gigs as Array<{ owner_profile_id: string; [k: string]: unknown }>).map((g) => ({
    ...g,
    owner: ownerById[g.owner_profile_id] ?? null,
  }));

  return ok({ gigs: list });
}
