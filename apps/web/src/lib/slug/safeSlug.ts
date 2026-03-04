/**
 * Safe slug for Linkary profile URLs. Ensures reserved paths and empty slugs
 * never get claimed; produces a stable fallback (e.g. dashboard -> dashboard-xxxx).
 * Single source for claim-time validation (used by all claim entry points).
 */
import { isReservedPath } from "@/lib/reservedPaths";

const MIN_SLUG_LENGTH = 2;

/** Normalize like existing flows: trim, lowercase, strip @, spaces to single hyphen, trim hyphens from ends. */
export function normalizeSlug(raw: string): string {
  const s = (raw ?? "").trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
  return s.replace(/-+/g, "-"); // collapse multiple hyphens
}

/** Stable suffix per user (first 6 chars of uuid without dashes) + optional attempt for retries. */
export function getStableUserSuffix(userId: string, attempt: number = 0): string {
  const base = (userId ?? "").replace(/-/g, "").slice(0, 6);
  if (attempt <= 0) return base;
  return base + String(attempt);
}

/**
 * Returns a slug safe to claim: normalized, and if reserved or too short, appends a stable suffix.
 * Does NOT check uniqueness (caller uses claimSafeSlug for that).
 */
export function safeSlug(desiredSlug: string, userId: string): { slug: string; isFallback: boolean } {
  const normalized = normalizeSlug(desiredSlug);
  const emptyOrTooShort = !normalized || normalized.length < MIN_SLUG_LENGTH;
  const reserved = isReservedPath(normalized);

  if (!emptyOrTooShort && !reserved) {
    return { slug: normalized, isFallback: false };
  }

  const base = normalized && normalized.length >= MIN_SLUG_LENGTH ? normalized : "user";
  let candidate = `${base}-${getStableUserSuffix(userId)}`;
  let attempts = 0;
  while (isReservedPath(candidate) && attempts < 5) {
    attempts += 1;
    candidate = `${base}-${getStableUserSuffix(userId, attempts)}`;
  }
  return { slug: candidate, isFallback: true };
}

const MAX_CLAIM_ATTEMPTS = 5;

/**
 * Attempts to claim a safe slug (reserved/empty -> fallback with suffix).
 * On USERNAME_TAKEN_VERIFIED, retries with a new suffix up to MAX_CLAIM_ATTEMPTS.
 */
export async function claimSafeSlug(
  desiredSlug: string,
  userId: string,
  claimFn: (slug: string) => Promise<{ error: string | null }>
): Promise<{ slug: string; error: string | null }> {
  let { slug } = safeSlug(desiredSlug, userId);
  for (let attempt = 0; attempt < MAX_CLAIM_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      slug = `${normalizeSlug(desiredSlug) || "user"}-${getStableUserSuffix(userId, attempt)}`;
      if (isReservedPath(slug)) continue;
    }
    const result = await claimFn(slug);
    if (!result.error) return { slug, error: null };
    if (!result.error.includes("USERNAME_TAKEN_VERIFIED")) return { slug, error: result.error };
  }
  return { slug, error: "USERNAME_TAKEN_VERIFIED" };
}
