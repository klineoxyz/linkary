/**
 * Unified entity resolution: one entry point for slug, UUID, X handle, wallet address.
 * Use for public URLs (/[identifier]), API lookups, and redirects.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicEntityByUsername, getPublicEntityById, getPublicEntityByWallet } from "./publicData";
import type { PublicEntity } from "./publicData";

export type IdentifierKind = "uuid" | "wallet" | "slug";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WALLET_REGEX = /^0x[a-fA-F0-9]{40}$/;

/** Normalize an identifier: trim, lowercase, strip leading @. */
export function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase().replace(/^@/, "");
}

/** Detect identifier type from raw string (before normalizing for slug). */
export function getIdentifierKind(value: string): IdentifierKind {
  const s = value.trim();
  if (UUID_REGEX.test(s)) return "uuid";
  if (WALLET_REGEX.test(s)) return "wallet";
  return "slug";
}

/**
 * Resolve any public identifier to a PublicEntity (profile or org).
 * - uuid: profile.id or org.id (public views)
 * - wallet: wallet_identities → user_id → profile (requires serviceSupabase; RLS blocks anon)
 * - slug: profile username / profile twitter_username / org slug (X handle, slug, etc.)
 */
export async function resolvePublicEntity(
  identifier: string,
  options?: { serviceSupabase?: SupabaseClient | null }
): Promise<PublicEntity | null> {
  const raw = identifier.trim();
  if (!raw) return null;

  const kind = getIdentifierKind(raw);

  if (kind === "uuid") return getPublicEntityById(raw);
  if (kind === "wallet" && options?.serviceSupabase) return getPublicEntityByWallet(raw, options.serviceSupabase);
  return getPublicEntityByUsername(normalizeIdentifier(raw));
}
