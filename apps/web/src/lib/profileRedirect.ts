/**
 * Profile page redirect rule: when viewing another user's username on the self-only
 * profile page, redirect to cross-user analytics viewer instead.
 * Tested so /app/profile stays self-only and ?username=other is handled correctly.
 */

/**
 * Returns true when the profile page should redirect to the analytics viewer:
 * viewUsername is set, publicSlug is set, and the normalized viewUsername is different
 * from the current user's public slug (i.e. viewing someone else).
 */
export function shouldRedirectProfileToAnalytics(
  viewUsername: string | undefined,
  publicSlug: string
): boolean {
  if (!viewUsername || !publicSlug) return false;
  const other = String(viewUsername).replace(/^@/, "").toLowerCase().trim();
  return other.length > 0 && other !== publicSlug;
}
