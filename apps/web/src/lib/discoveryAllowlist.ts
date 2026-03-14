/**
 * Future paid Linkary discovery/search allowlist.
 *
 * Visibility model:
 * - owner_private: only profile owner
 * - public_profile: visible on /{username} to anyone
 * - searchable_discovery: visible only to eligible paid/internal discovery surfaces; must be explicitly allowlisted.
 *
 * Rule: Paid discovery can reveal ONLY this allowlisted dataset. Never owner-private or sensitive fields.
 * Public profile visibility and paid discovery visibility are NOT the same thing.
 *
 * DO NOT include in discovery payloads:
 * - email (auth or any contact)
 * - exact location
 * - pricing / pricing notes
 * - auth/account identifiers (user_id, internal ids)
 * - private metadata
 * - unpublished/private relations
 * - private review data
 * - raw private metadata
 */

import type { PublicProfileDTO, PublicOrgDTO } from "./publicProfileDTO";

/**
 * Safe fields for future paid search/discovery results (profiles).
 * Explicit allowlist; anything not listed must not be exposed.
 */
export type DiscoveryProfileResult = {
  type: "profile";
  /** Canonical handle for linking to /{username} */
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  profile_type?: "individual" | "project" | "company" | null;
  /** Only socials that are already public on profile; no private contact data */
  twitter_username: string | null;
  /** High-level credibility metrics only when explicitly approved for discovery */
  xscore: number | null;
  /** Aggregated analytics snapshot only if approved for discovery; no raw private metrics */
  analytics_snapshot?: {
    followers: number | null;
    engagement_rate: number | null;
  } | null;
  /** Non-sensitive tags/categories/skills if we add them and allowlist */
  tags?: string[];
};

/**
 * Safe fields for future paid search/discovery results (orgs).
 */
export type DiscoveryOrgResult = {
  slug: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  twitter_username: string | null;
  xscore: number | null;
  analytics_snapshot?: {
    followers: number | null;
    engagement_rate: number | null;
  } | null;
  ecosystem_categories?: string[];
};

export type DiscoverySearchResult = DiscoveryProfileResult | DiscoveryOrgResult;

/**
 * Build a discovery-safe payload from a public profile DTO.
 * Use this (or a server-side equivalent) for any future discovery/search API.
 * Never pass owner/private payloads or raw DB rows into discovery responses.
 */
export function publicProfileToDiscoveryResult(dto: PublicProfileDTO): DiscoveryProfileResult {
  return {
    username: dto.username ?? null,
    display_name: dto.display_name ?? null,
    avatar_url: dto.avatar_url ?? null,
    bio: dto.bio ?? null,
    profile_type: (dto as { profile_type?: "individual" | "project" | "company" | null }).profile_type ?? null,
    twitter_username: dto.twitter_username ?? null,
    xscore: dto.xscore ?? null,
    analytics_snapshot: dto.analytics?.snapshot
      ? {
          followers: dto.analytics.snapshot.followers ?? null,
          engagement_rate: dto.analytics.snapshot.engagement_rate ?? null,
        }
      : null,
    tags: [],
  };
}

/**
 * Build a discovery-safe payload from a public org DTO.
 */
export function publicOrgToDiscoveryResult(dto: PublicOrgDTO): DiscoveryOrgResult {
  return {
    type: "org",
    slug: dto.slug,
    name: dto.name,
    tagline: dto.tagline ?? null,
    logo_url: dto.logo_url ?? null,
    twitter_username: dto.twitter_username ?? null,
    xscore: dto.xscore ?? null,
    analytics_snapshot: dto.analytics?.snapshot
      ? {
          followers: dto.analytics.snapshot.followers ?? null,
          engagement_rate: dto.analytics.snapshot.engagement_rate ?? null,
        }
      : null,
    ecosystem_categories: dto.ecosystemCategories ?? [],
  };
}
