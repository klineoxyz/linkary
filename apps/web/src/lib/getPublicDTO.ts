/**
 * Server-only: resolve username to public DTO or unpublished state. Single source for public page data.
 * Never returns email, user_id, or internal fields.
 * When serviceSupabase is provided, file_path media is resolved to signed URLs before DTO mapping.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicEntityByUsername, getPublicEntityForOwner } from "./publicData";
import { entityToPublicDTO, type PublicPageDTO } from "./publicProfileDTO";
import { normalizeIdentifier } from "./entityResolver";
import { resolveEntityMediaToSignedUrls } from "./resolveEntityMediaUrls";

export type PublicDTOResult =
  | { ok: true; dto: PublicPageDTO; canonicalUsername: string }
  | { ok: false; unpublished: true; username: string }
  | { ok: false; notFound: true };

/**
 * Resolve username/slug to public DTO. If not in public view, check if profile exists but is unpublished.
 * Uses serviceSupabase only for unpublished check (profiles table by username).
 */
export async function getPublicDTOByUsername(
  segment: string,
  options?: { serviceSupabase?: SupabaseClient | null }
): Promise<PublicDTOResult> {
  const norm = normalizeIdentifier(segment);
  if (!norm) return { ok: false, notFound: true };

  let entity = await getPublicEntityByUsername(norm);
  if (entity && options?.serviceSupabase) {
    entity = await resolveEntityMediaToSignedUrls(entity, options.serviceSupabase);
  }
  if (entity) {
    const dto = entityToPublicDTO(entity);
    const canonicalUsername =
      entity.type === "profile"
        ? (entity.profile?.username ?? entity.profile?.twitter_username ?? "").replace(/^@/, "").toLowerCase()
        : (entity.org?.slug ?? "").toLowerCase();
    return { ok: true, dto, canonicalUsername: canonicalUsername || norm };
  }

  if (options?.serviceSupabase) {
    const { data: row } = await options.serviceSupabase
      .from("profiles")
      .select("username, published")
      .ilike("username", norm)
      .maybeSingle();
    if (row && (row as { published?: boolean }).published === false) {
      return { ok: false, unpublished: true, username: (row as { username: string }).username ?? norm };
    }
  }

  return { ok: false, notFound: true };
}

/**
 * Resolve username/slug to public DTO when the caller is the owner (profile or org admin).
 * Uses serviceSupabase to read data regardless of published state.
 * Returns null if not found or not owner.
 */
export async function getPublicDTOForOwner(
  segment: string,
  userId: string,
  serviceSupabase: SupabaseClient
): Promise<{ dto: PublicPageDTO; canonicalUsername: string } | null> {
  const norm = normalizeIdentifier(segment);
  if (!norm) return null;

  let entity = await getPublicEntityForOwner(norm, userId, serviceSupabase);
  if (!entity) return null;

  entity = await resolveEntityMediaToSignedUrls(entity, serviceSupabase);
  const dto = entityToPublicDTO(entity);
  const canonicalUsername =
    entity.type === "profile"
      ? (entity.profile?.username ?? entity.profile?.twitter_username ?? "").replace(/^@/, "").toLowerCase()
      : (entity.org?.slug ?? "").toLowerCase();
  return { dto, canonicalUsername: canonicalUsername || norm };
}
