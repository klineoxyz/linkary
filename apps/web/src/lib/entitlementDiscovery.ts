/**
 * Entitlement check for paid Linkary discovery/search.
 *
 * Discovery is a separate visibility layer (searchable_discovery), not the same as public_profile.
 * Only eligible users (e.g. paid plan, internal, or feature-flag) may access discovery APIs.
 *
 * This module is the single place for "can this user use discovery?" so we can later plug in
 * billing, feature flags, or allowlists without scattering checks.
 */

/**
 * Whether the user is eligible to use paid discovery/search.
 * If false, discovery API routes must return 403 and no discovery data.
 *
 * Current: returns true only when LINKARY_DISCOVERY_ELIGIBLE=true (env) or for a future paid check.
 * TODO: Replace with real entitlement (subscription tier, feature flag, or allowlist).
 */
export async function isEligibleForDiscovery(_userId: string): Promise<boolean> {
  const envFlag = process.env.LINKARY_DISCOVERY_ELIGIBLE === "true";
  if (envFlag) return true;
  // Future: check subscription, feature flag, or allowlist.
  return false;
}
