/**
 * Strict allowlist DTO for public profile/org pages. Never spread raw DB; map explicitly.
 * No email, user_id, bearer tokens, or internal fields. All URLs sanitized (https/http only).
 */
import type { PublicEntity } from "./publicData";
import { sanitizeUrl } from "./sanitizeUrl";

export type PublicProfileDTO = {
  type: "profile";
  display_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  website: string | null;
  twitter_username: string | null;
  location: string | null;
  published: boolean;
  socials: {
    x_url: string | null;
    linkedin_url: string | null;
    youtube_url: string | null;
    website_url: string | null;
    telegram_url: string | null;
  } | null;
  ethosScore: number | null;
  xscore: number | null;
  linkaryPower: number | null;
  analytics: {
    source: "worker" | "partial" | "fallback";
    initialized: boolean;
    snapshot: {
      followers: number | null;
      engagement_rate: number | null;
      reach_avg: number | null;
      likes_avg: number | null;
      replies_avg: number | null;
      followers_delta: number | null;
    } | null;
  };
  caseStudies: Array<{ id: string; title?: string | null; description?: string | null; proof_url?: string | null; created_at: string }>;
  reviews: Array<{ id: string; rating: number; body?: string | null; title?: string | null; created_at: string }>;
  affiliates: Array<{ name: string; website_url: string | null; logo_url: string | null; description: string | null; since_date: string | null }>;
  ambassadors: Array<{ name: string; website_url: string | null; logo_url: string | null; description: string | null; since_date: string | null }>;
  publicLayout: { order?: string[]; hidden?: string[] } | null;
  headerMedia: { header_media_type: "NONE" | "IMAGE" | "VIDEO"; header_media_url: string | null } | null;
  tier: "free" | "pro";
};

export type PublicOrgDTO = {
  type: "org";
  name: string;
  slug: string;
  tagline: string | null;
  website: string | null;
  twitter_username: string | null;
  logo_url: string | null;
  published: boolean;
  xscore: number | null;
  linkaryInfluence: number | null;
  analytics: {
    source: "worker" | "partial" | "fallback";
    initialized: boolean;
    snapshot: {
      followers: number | null;
      engagement_rate: number | null;
      reach_avg: number | null;
      likes_avg: number | null;
      replies_avg: number | null;
      followers_delta: number | null;
    } | null;
  };
  caseStudies: PublicProfileDTO["caseStudies"];
  reviews: PublicProfileDTO["reviews"];
  affiliates: PublicProfileDTO["affiliates"];
  ambassadors: PublicProfileDTO["ambassadors"];
  ecosystemCategories: string[];
  subsidiaries: Array<{ id: string; slug: string; name: string; logo_url: string | null }>;
  publicLayout: PublicProfileDTO["publicLayout"];
  headerMedia: PublicProfileDTO["headerMedia"];
  tier: "free" | "pro";
  dexscreenerUrl: string | null;
  tokenSymbol: string | null;
};

export type PublicPageDTO = PublicProfileDTO | PublicOrgDTO;

/** Derive analytics source and initialized from entity (profile only; org always worker/initialized). */
export function getAnalyticsMeta(entity: PublicEntity): { source: "worker" | "partial" | "fallback"; initialized: boolean } {
  if (entity.type === "org") return { source: "worker", initialized: true };
  const snap = entity.analyticsSnapshot;
  if (!snap) return { source: "fallback", initialized: false };
  const hasWindowData = snap.reach_avg != null;
  return { source: hasWindowData ? "worker" : "partial", initialized: true };
}

/** Map PublicEntity (profile) to strict DTO. No raw spread. */
export function entityToPublicDTO(entity: PublicEntity, analyticsSource?: "worker" | "partial" | "fallback", analyticsInitialized?: boolean): PublicProfileDTO | PublicOrgDTO {
  const meta = getAnalyticsMeta(entity);
  const source = analyticsSource ?? meta.source;
  const initialized = analyticsInitialized ?? meta.initialized;
  if (entity.type === "profile" && entity.profile) {
    const p = entity.profile;
    return {
      type: "profile",
      display_name: p.display_name ?? null,
      username: p.username ?? null,
      bio: p.bio ?? null,
      avatar_url: sanitizeUrl(p.avatar_url) ?? null,
      website: sanitizeUrl(p.website) ?? null,
      twitter_username: p.twitter_username ?? null,
      location: p.location ?? null,
      published: p.published ?? false,
      socials: entity.socials ? {
        x_url: sanitizeUrl(entity.socials.x_url) ?? null,
        linkedin_url: sanitizeUrl(entity.socials.linkedin_url) ?? null,
        youtube_url: sanitizeUrl(entity.socials.youtube_url) ?? null,
        website_url: sanitizeUrl(entity.socials.website_url) ?? null,
        telegram_url: sanitizeUrl(entity.socials.telegram_url) ?? null,
      } : null,
      ethosScore: entity.ethosScore ?? null,
      xscore: p.xscore ?? null,
      linkaryPower: entity.linkaryPower ?? null,
      analytics: {
        source,
        initialized,
        snapshot: entity.analyticsSnapshot ? {
          followers: entity.analyticsSnapshot.followers ?? null,
          engagement_rate: entity.analyticsSnapshot.engagement_rate ?? null,
          reach_avg: entity.analyticsSnapshot.reach_avg ?? null,
          likes_avg: entity.analyticsSnapshot.likes_avg ?? null,
          replies_avg: entity.analyticsSnapshot.replies_avg ?? null,
          followers_delta: entity.analyticsSnapshot.followers_delta ?? null,
        } : null,
      },
      caseStudies: entity.caseStudies.map((c) => ({
        id: c.id,
        title: c.title ?? null,
        description: c.description ?? null,
        proof_url: sanitizeUrl(c.proof_url) ?? null,
        created_at: c.created_at,
      })),
      reviews: entity.reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        body: r.body ?? null,
        title: r.title ?? null,
        created_at: r.created_at,
      })),
      affiliates: entity.affiliates.map((a) => ({
        name: a.name,
        website_url: sanitizeUrl(a.website_url) ?? null,
        logo_url: sanitizeUrl(a.logo_url) ?? null,
        description: a.description ?? null,
        since_date: a.since_date ?? null,
      })),
      ambassadors: entity.ambassadors.map((a) => ({
        name: a.name,
        website_url: sanitizeUrl(a.website_url) ?? null,
        logo_url: sanitizeUrl(a.logo_url) ?? null,
        description: a.description ?? null,
        since_date: a.since_date ?? null,
      })),
      publicLayout: entity.publicLayout ?? null,
      headerMedia: entity.headerMedia ? { header_media_type: entity.headerMedia.header_media_type, header_media_url: sanitizeUrl(entity.headerMedia.header_media_url) ?? null } : null,
      tier: entity.tier,
    };
  }
  if (entity.type === "org" && entity.org) {
    const o = entity.org;
    return {
      type: "org",
      name: o.name,
      slug: o.slug,
      tagline: o.tagline ?? null,
      website: sanitizeUrl(o.website) ?? null,
      twitter_username: o.twitter_username ?? null,
      logo_url: sanitizeUrl(o.logo_url) ?? null,
      published: true,
      xscore: o.xscore ?? null,
      linkaryInfluence: entity.linkaryInfluence ?? null,
      analytics: {
        source: "worker",
        initialized: true,
        snapshot: entity.analyticsSnapshot ? {
          followers: entity.analyticsSnapshot.followers ?? null,
          engagement_rate: entity.analyticsSnapshot.engagement_rate ?? null,
          reach_avg: entity.analyticsSnapshot.reach_avg ?? null,
          likes_avg: entity.analyticsSnapshot.likes_avg ?? null,
          replies_avg: entity.analyticsSnapshot.replies_avg ?? null,
          followers_delta: entity.analyticsSnapshot.followers_delta ?? null,
        } : null,
      },
      caseStudies: entity.caseStudies.map((c) => ({
        id: c.id,
        title: c.title ?? null,
        description: c.description ?? null,
        proof_url: sanitizeUrl(c.proof_url) ?? null,
        created_at: c.created_at,
      })),
      reviews: entity.reviews.map((r) => ({ id: r.id, rating: r.rating, body: r.body ?? null, title: r.title ?? null, created_at: r.created_at })),
      affiliates: entity.affiliates.map((a) => ({
        name: a.name,
        website_url: sanitizeUrl(a.website_url) ?? null,
        logo_url: sanitizeUrl(a.logo_url) ?? null,
        description: a.description ?? null,
        since_date: a.since_date ?? null,
      })),
      ambassadors: entity.ambassadors.map((a) => ({
        name: a.name,
        website_url: sanitizeUrl(a.website_url) ?? null,
        logo_url: sanitizeUrl(a.logo_url) ?? null,
        description: a.description ?? null,
        since_date: a.since_date ?? null,
      })),
      ecosystemCategories: entity.ecosystemCategories ?? [],
      subsidiaries: entity.subsidiaries.map((s) => ({ id: s.id, slug: s.slug, name: s.name, logo_url: sanitizeUrl(s.logo_url) ?? null })),
      publicLayout: entity.publicLayout ?? null,
      headerMedia: entity.headerMedia ? { header_media_type: entity.headerMedia.header_media_type, header_media_url: sanitizeUrl(entity.headerMedia.header_media_url) ?? null } : null,
      tier: entity.tier,
      dexscreenerUrl: sanitizeUrl(entity.dexscreenerUrl) ?? null,
      tokenSymbol: entity.tokenSymbol ?? null,
    };
  }
  throw new Error("Invalid entity");
}

/** View shape returned by dtoToEntityView; no profile.id or org.id. Safe for client. */
export type PublicEntityView = {
  type: "profile" | "org";
  analyticsSource: "worker" | "partial" | "fallback";
  analyticsInitialized: boolean;
  profile?: {
    display_name: string | null;
    username: string | null;
    bio: string | null;
    avatar_url: string | null;
    website: string | null;
    twitter_username: string | null;
    location: string | null;
    xscore: number | null;
  };
  org?: {
    name: string;
    slug: string;
    tagline: string | null;
    website: string | null;
    twitter_username: string | null;
    logo_url: string | null;
    xscore: number | null;
  };
  publicLayout: PublicProfileDTO["publicLayout"];
  socials: PublicProfileDTO["socials"];
  headerMedia: PublicProfileDTO["headerMedia"];
  analyticsSnapshot: PublicProfileDTO["analytics"]["snapshot"] extends infer S ? (S extends { followers: number | null } ? S & { reach_avg?: number | null; likes_avg?: number | null; replies_avg?: number | null; spaces_count?: number | null } : null) : null;
  ethosScore: number | null;
  ethosResults: Record<string, unknown> | null;
  linkaryPower?: number;
  linkaryInfluence?: number;
  tier: "free" | "pro";
  caseStudies: PublicProfileDTO["caseStudies"];
  reviews: PublicProfileDTO["reviews"];
  affiliates: PublicProfileDTO["affiliates"];
  ambassadors: PublicProfileDTO["ambassadors"];
  ecosystemCategories: string[];
  subsidiaries: Array<{ id: string; slug: string; name: string; logo_url: string | null }>;
  dexscreenerUrl?: string | null;
  tokenSymbol?: string | null;
};

/**
 * Build an entity-like view from DTO for the public one-pager component. No profile.id or org.id.
 * Safe to serialize and send to client. Includes analytics meta for banners.
 */
export function dtoToEntityView(dto: PublicPageDTO): PublicEntityView {
  if (dto.type === "profile") {
    const snap = dto.analytics.snapshot;
    return {
      type: "profile",
      analyticsSource: dto.analytics.source,
      analyticsInitialized: dto.analytics.initialized,
      profile: {
        display_name: dto.display_name,
        username: dto.username,
        bio: dto.bio,
        avatar_url: dto.avatar_url,
        website: dto.website,
        twitter_username: dto.twitter_username,
        location: dto.location,
        xscore: dto.xscore,
      },
      publicLayout: dto.publicLayout,
      socials: dto.socials,
      headerMedia: dto.headerMedia,
      analyticsSnapshot: snap ? { ...snap, reach_avg: snap.reach_avg ?? null, likes_avg: snap.likes_avg ?? null, replies_avg: snap.replies_avg ?? null, spaces_count: null } : null,
      ethosScore: dto.ethosScore,
      ethosResults: null,
      linkaryPower: dto.linkaryPower ?? undefined,
      tier: dto.tier,
      caseStudies: dto.caseStudies,
      reviews: dto.reviews,
      affiliates: dto.affiliates,
      ambassadors: dto.ambassadors,
      ecosystemCategories: [],
      subsidiaries: [],
    };
  }
  const snap = dto.analytics.snapshot;
  return {
    type: "org",
    analyticsSource: dto.analytics.source,
    analyticsInitialized: dto.analytics.initialized,
    org: {
      name: dto.name,
      slug: dto.slug,
      tagline: dto.tagline,
      website: dto.website,
      twitter_username: dto.twitter_username,
      logo_url: dto.logo_url,
      xscore: dto.xscore,
    },
    publicLayout: dto.publicLayout,
    socials: null,
    headerMedia: dto.headerMedia,
    analyticsSnapshot: snap ? { ...snap, reach_avg: snap.reach_avg ?? null, likes_avg: snap.likes_avg ?? null, replies_avg: snap.replies_avg ?? null, spaces_count: null } : null,
    ethosScore: dto.xscore,
    ethosResults: null,
    linkaryInfluence: dto.linkaryInfluence ?? undefined,
    tier: dto.tier,
    caseStudies: dto.caseStudies,
    reviews: dto.reviews,
    affiliates: dto.affiliates,
    ambassadors: dto.ambassadors,
    ecosystemCategories: dto.ecosystemCategories,
    subsidiaries: dto.subsidiaries,
    dexscreenerUrl: dto.dexscreenerUrl,
    tokenSymbol: dto.tokenSymbol,
  };
}
