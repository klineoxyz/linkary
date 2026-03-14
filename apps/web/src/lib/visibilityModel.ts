/**
 * Linkary visibility model (documentation).
 *
 * Three distinct visibility classes:
 *
 * 1) owner_private
 *    - Visible only to the profile/org owner.
 *    - Examples: full profile row, email, location, pricing, private metadata, analytics deep-dive.
 *    - Source: getMyProfile(), owner-only API, /app/profile, /app/profile/edit, /analytics.
 *
 * 2) public_profile
 *    - Visible on /{username} to anyone (anonymous or logged-in).
 *    - Gated by meta.public_location, meta.public_pricing, analytics_visibility, per-item is_public.
 *    - Source: public_profile_view, public DTOs, buildPublicProfilePayload, /api/public/profile.
 *
 * 3) searchable_discovery
 *    - Visible only to eligible paid/internal discovery surfaces inside Linkary.
 *    - NOT the same as public_profile: different allowlist, separately reviewed.
 *    - Must be explicitly allowlisted; must never include email, exact location, pricing, auth ids, private metadata.
 *    - Source: discoveryService, discoveryAllowlist types, /api/me/discovery/* (after entitlement check).
 *
 * Rule: Paid discovery can reveal only the explicit discovery allowlist. Never owner_private or
 * sensitive fields. Public profile visibility and paid discovery visibility are not the same thing.
 */

export { DISCOVERY_PROFILE_ALLOWED_FIELDS, DISCOVERY_FORBIDDEN_FIELDS } from "./discoveryAllowlist";
