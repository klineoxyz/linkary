/**
 * Server-only org resolution for /org/[segment].
 * Resolves by slug (orgs table, any published state) or by usernames → org id.
 * Use from org page Server Component so valid orgs load and invalid segments 404.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUsernameOwner } from "./publicData";

export type ResolvedOrg = { id: string; slug: string; name: string };

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/^@/, "");
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolve segment (slug or uuid) to an org. Tries: (1) by id if segment is UUID,
 * (2) by slug on orgs table (case-insensitive, any published state), (3) usernames → org id.
 * Returns null if not found.
 */
export async function resolveOrgBySegment(
  segment: string,
  supabase: SupabaseClient
): Promise<ResolvedOrg | null> {
  const raw = decodeURIComponent(segment).trim();
  if (!raw) return null;

  /** Prefer RPC: works when prod RLS/PostgREST blocks direct orgs/usernames reads from the SSR client. */
  const { data: rpcRows, error: rpcErr } = await supabase.rpc("resolve_org_public_by_segment", {
    p_segment: raw,
  });
  if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
    const row = rpcRows[0] as { id?: string; slug?: string | null; name?: string | null };
    if (row?.id) {
      return {
        id: row.id,
        slug: (row.slug as string) ?? "",
        name: (row.name as string) ?? "",
      };
    }
  }

  const norm = normalize(raw);

  if (UUID_REGEX.test(raw)) {
    const { data } = await supabase
      .from("orgs")
      .select("id, slug, name")
      .eq("id", raw)
      .maybeSingle();
    if (data && (data as { id?: string }).id) {
      return { id: (data as { id: string }).id, slug: (data as { slug: string }).slug ?? "", name: (data as { name: string }).name ?? "" };
    }
    return null;
  }

  const { data: bySlug } = await supabase
    .from("orgs")
    .select("id, slug, name")
    .ilike("slug", norm)
    .maybeSingle();
  if (bySlug && (bySlug as { id?: string }).id) {
    return { id: (bySlug as { id: string }).id, slug: (bySlug as { slug: string }).slug ?? "", name: (bySlug as { name: string }).name ?? "" };
  }

  const owner = await getUsernameOwner(norm, supabase);
  if (owner?.owner_type === "org" && owner.owner_id) {
    const { data: byId } = await supabase
      .from("orgs")
      .select("id, slug, name")
      .eq("id", owner.owner_id)
      .maybeSingle();
    if (byId && (byId as { id?: string }).id) {
      return { id: (byId as { id: string }).id, slug: (byId as { slug: string }).slug ?? "", name: (byId as { name: string }).name ?? "" };
    }
  }

  return null;
}
