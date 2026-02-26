/**
 * Resolver for /{slug} (slug kind). Used by the public username page to decide:
 * public (show PublicProfileContent), owner_unpublished (show owner CTA), or claim.
 * Only call when the slug is NOT found in public_profile_view (i.e. public API returned 404).
 */

import { normalizeIdentifier } from "./entityResolver";

export type SlugResolution =
  | { kind: "public" }
  | { kind: "owner_unpublished"; username: string }
  | { kind: "claim" };

type ProfileRow = {
  username?: string | null;
  twitter_username?: string | null;
  published?: boolean;
};

/**
 * Resolve slug when public view has no row. If the current user's profile
 * (username or twitter_username, normalized) matches the slug and is not published,
 * return owner_unpublished; otherwise claim.
 */
export function resolveSlugForOwner(
  requestedSlug: string,
  currentUserProfile: ProfileRow | null
): SlugResolution {
  const norm = normalizeIdentifier(requestedSlug);
  if (!norm) return { kind: "claim" };

  if (!currentUserProfile) return { kind: "claim" };

  const usernameNorm = (currentUserProfile.username ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");
  const twitterNorm = (currentUserProfile.twitter_username ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");

  const matches =
    usernameNorm === norm || twitterNorm === norm;
  const unpublished =
    currentUserProfile.published !== true;

  if (matches && unpublished) {
    return { kind: "owner_unpublished", username: norm };
  }

  return { kind: "claim" };
}
