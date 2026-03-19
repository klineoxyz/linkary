/**
 * Server-only org resolution for /org/[segment].
 * Resolves by slug (orgs table, any published state) or by usernames → org id.
 * Use from org page Server Component so valid orgs load and invalid segments 404.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getUsernameOwner } from "./publicData";

export type ResolvedOrg = { id: string; slug: string; name: string };

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/^@/, "");
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Above this, skip in-memory hyphen match (apply migrations through `20260425120000` and rely on RPC). */
const MAX_ORGS_FOR_HYPHEN_COLLAPSE_SCAN = 20000;

/**
 * Hyphen-stripped slug match (e.g. desicryptoclub ↔ desi-crypto-club).
 * If multiple orgs collide on collapsed form, prefer exact lower(slug)=norm, then shortest slug, then id (matches RPC).
 */
async function resolveOrgByHyphenCollapsedSlug(
  supabase: SupabaseClient,
  norm: string
): Promise<ResolvedOrg | null> {
  const collapsed = norm.replace(/-/g, "");
  if (collapsed.length < 2) return null;

  // Use service-role for this scan because the SSR client is built with the anon key (RLS may block direct reads).
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
  const scanClient =
    serviceUrl && serviceKey
      ? createClient(serviceUrl, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        })
      : supabase;

  const { count, error: countErr } = await scanClient.from("orgs").select("id", { count: "exact", head: true });
  if (countErr || count == null || count > MAX_ORGS_FOR_HYPHEN_COLLAPSE_SCAN) return null;

  const { data: rows, error } = await scanClient.from("orgs").select("id, slug, name, created_at");
  if (error || !rows?.length) return null;

  const matches = rows.filter(
    (r) =>
      String((r as { slug?: string | null }).slug ?? "")
        .toLowerCase()
        .replace(/-/g, "") === collapsed
  );
  if (matches.length === 0) return null;
  if (matches.length === 1) {
    const r = matches[0] as { id: string; slug: string; name: string };
    return { id: r.id, slug: r.slug ?? "", name: r.name ?? "" };
  }

  const sorted = [...matches].sort((a, b) => {
    const sa = String((a as { slug?: string | null }).slug ?? "")
      .trim()
      .toLowerCase();
    const sb = String((b as { slug?: string | null }).slug ?? "")
      .trim()
      .toLowerCase();
    const exactA = sa === norm ? 1 : 0;
    const exactB = sb === norm ? 1 : 0;
    if (exactB !== exactA) return exactB - exactA;
    if (sa.length !== sb.length) return sa.length - sb.length;
    const ta = String((a as { created_at?: string | null }).created_at ?? "");
    const tb = String((b as { created_at?: string | null }).created_at ?? "");
    if (tb !== ta) return tb.localeCompare(ta);
    return String((a as { id: string }).id).localeCompare(String((b as { id: string }).id));
  });
  const r = sorted[0] as { id: string; slug: string; name: string };
  return { id: r.id, slug: r.slug ?? "", name: r.name ?? "" };
}

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

  const byCollapsed = await resolveOrgByHyphenCollapsedSlug(supabase, norm);
  if (byCollapsed) return byCollapsed;

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
