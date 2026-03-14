/**
 * Defensive response shaping for discovery API.
 * Ensures only allowlisted fields are serialized; no accidental leakage of id, email, location,
 * meta, pricing, auth ids, or private metadata. We copy only keys in PROFILE_KEYS / ORG_KEYS
 * so even if upstream data or serialization adds extra fields, they cannot appear in the response.
 */

import type { DiscoveryProfileResult, DiscoveryOrgResult } from "./discoveryAllowlist";
import { DISCOVERY_PROFILE_ALLOWED_FIELDS } from "./discoveryAllowlist";

const PROFILE_KEYS = new Set<string>(DISCOVERY_PROFILE_ALLOWED_FIELDS as unknown as string[]);
const ORG_KEYS = new Set([
  "type", "slug", "name", "tagline", "logo_url", "twitter_username", "xscore",
  "analytics_snapshot", "ecosystem_categories",
]);

/**
 * Shape a single profile result for API response. Returns a plain object with only
 * allowlisted keys so serialization cannot leak forbidden fields.
 */
export function shapeDiscoveryProfileForResponse(item: DiscoveryProfileResult): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of PROFILE_KEYS) {
    if (key in item) {
      const v = (item as Record<string, unknown>)[key];
      if (key === "analytics_snapshot" && v != null && typeof v === "object") {
        const snap = v as { followers?: number | null; engagement_rate?: number | null };
        out[key] = {
          followers: snap.followers ?? null,
          engagement_rate: snap.engagement_rate ?? null,
        };
      } else {
        out[key] = v;
      }
    }
  }
  return out;
}

/**
 * Shape a single org result for API response. Only allowlisted keys.
 */
export function shapeDiscoveryOrgForResponse(item: DiscoveryOrgResult): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of ORG_KEYS) {
    if (key in item) {
      const v = (item as Record<string, unknown>)[key];
      if (key === "analytics_snapshot" && v != null && typeof v === "object") {
        const snap = v as { followers?: number | null; engagement_rate?: number | null };
        out[key] = {
          followers: snap.followers ?? null,
          engagement_rate: snap.engagement_rate ?? null,
        };
      } else {
        out[key] = v;
      }
    }
  }
  return out;
}

/**
 * Shape profiles array for API response. Guarantees no forbidden fields in JSON.
 */
export function shapeDiscoveryProfilesResponse(
  items: DiscoveryProfileResult[]
): Record<string, unknown>[] {
  return items.map(shapeDiscoveryProfileForResponse);
}

/**
 * Shape orgs array for API response.
 */
export function shapeDiscoveryOrgsResponse(items: DiscoveryOrgResult[]): Record<string, unknown>[] {
  return items.map(shapeDiscoveryOrgForResponse);
}
