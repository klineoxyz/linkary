/**
 * GET /api/public/profile?username=...
 * Returns a single public-safe JSON payload for the Linktree-style public profile page.
 * No private analytics (followers/engagement snapshot); only proof numbers (ethos, xscore, reputation).
 * Cache: s-maxage=300, stale-while-revalidate=3600.
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getPublicEntityByUsername } from "@/lib/publicData";
import { entityToPublicDTO } from "@/lib/publicProfileDTO";
import { normalizeIdentifier } from "@/lib/entityResolver";
import { supabase } from "@/lib/supabase";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { resolveEntityMediaToSignedUrls } from "@/lib/resolveEntityMediaUrls";

const CACHE_PUBLIC = "s-maxage=300, stale-while-revalidate=3600";
const CACHE_404 = "s-maxage=30, stale-while-revalidate=60";

export type PublicProfileApiPayload = {
  profile: {
    username: string | null;
    display_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    location: string | null;
    roles: string[];
    is_verified: boolean;
    ethos_score: number | null;
    xscore: number | null;
    reputation_index: number | null;
    rep_score: number | null;
    profile_type?: "individual" | "project" | "company";
    /** Layout preset: classic (default), spotlight, showcase, compact */
    public_layout?: "classic" | "spotlight" | "showcase" | "compact" | null;
    /** Section keys in display order (from profiles.public_layout.order) */
    layout_order?: string[] | null;
    /** Section keys to hide (from profiles.public_layout.hidden) */
    layout_hidden?: string[] | null;
    /** Featured item IDs (from profiles.public_layout) */
    featured_case_study_id?: string | null;
    featured_review_id?: string | null;
    featured_gig_id?: string | null;
  };
  hero?: {
    hero_image_url: string | null;
    hero_video_url: string | null;
    hero_title: string | null;
  } | null;
  team?: Array<{
    name: string;
    role: string | null;
    avatar_url: string | null;
    linkedin_url?: string | null;
    x_url?: string | null;
    website_url?: string | null;
    is_public: boolean;
  }>;
  socials: {
    x: string | null;
    telegram: string | null;
    discord: string | null;
    linkedin: string | null;
    website: string | null;
    youtube: string | null;
  };
  links: Array<{ title: string; url: string; icon?: string | null }>;
  caseStudies: Array<{ id: string; title: string | null; summary: string | null; tags: string[]; url: string | null; imageUrl?: string | null }>;
  reviews: {
    average: number | null;
    count: number;
    latest: Array<{
      id?: string;
      rating: number;
      title: string | null;
      text: string | null;
      created_at: string;
      reviewer_display: string | null;
      reviewer_avatar_url: string | null;
      verified_deal?: boolean;
      /** 'collab' = Verified badge; 'legacy' = Unverified or no badge */
      source?: "collab" | "legacy";
    }>;
  };
  /** When false, Reviews section is hidden on public profile */
  show_reviews?: boolean;
  /** Completed collaborations (done collab_requests, public counterparties only) */
  completed_collabs?: {
    total: number;
    counterparties: Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null }>;
  };
  /** Project token data from Dexscreener (profile_type=project only) */
  token?: {
    url: string;
    chainId?: string;
    pairAddress?: string;
    baseSymbol?: string;
    quoteSymbol?: string;
    priceUsd?: number;
    priceChangeH24?: number;
    liquidityUsd?: number;
    volumeH24?: number;
    fdv?: number;
    marketCap?: number;
    updatedAt?: string;
  } | null;
  /** Unified relations (only is_public). For individual: ambassadorOf, affiliateOf. For project/company: ambassadors, affiliates, ecosystemProjects, subsidiaries. */
  relations?: {
    ambassadorOf?: Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; profile_type: string }>;
    affiliateOf?: Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; profile_type: string }>;
    ambassadors?: Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; profile_type: string }>;
    affiliates?: Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; profile_type: string }>;
    ecosystemProjects?: Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; profile_type: string }>;
    subsidiaries?: Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null; profile_type: string }>;
  };
  /** Open public gigs (project/company only). */
  gigs?: Array<{
    id: string;
    title: string;
    description: string;
    gig_type: string;
    compensation_type: string;
    budget_text: string | null;
    location: string | null;
    remote: boolean;
    created_at: string;
  }>;
  /** Skills (individual) or Services/Expertise (company). Public only. */
  skills?: Array<{ name: string; level?: number | null }>;
  /** Achievements (individual). Public only. */
  achievements?: Array<{ title: string; description: string | null; url: string | null }>;
  /** Header media (banner image/video) for public one-pager. */
  header_media?: { type: "IMAGE" | "VIDEO"; url: string } | null;
  /** CV download: stable URL that redirects to signed storage URL (only when profile has CV and is published). */
  cv?: { download_url: string } | null;
  /** Partner programs (profile-level). Public only. */
  partner_programs?: Array<{
    name: string;
    program_type?: string | null;
    website_url?: string | null;
    logo_url?: string | null;
    description?: string | null;
    is_featured?: boolean;
  }>;
  /** Pricing block (USD). Only present when meta.public_pricing and at least one price set. */
  pricing?: {
    post?: { price_usd: number; platforms: string[]; notes?: string | null };
    podcast?: { price_usd: number; platforms: string[]; notes?: string | null };
  } | null;
  /** True when the viewer is the profile owner (server session). Used for owner-only CTAs (e.g. Add proof card). Omit or false when not available. */
  viewer_is_owner?: boolean;
};

function tagsFromMetrics(metrics: unknown): string[] {
  if (metrics == null || typeof metrics !== "object") return [];
  const m = metrics as Record<string, unknown>;
  const t = m.tags ?? m.tag;
  if (Array.isArray(t) && t.every((x) => typeof x === "string")) return t as string[];
  return [];
}

async function getDebugPayload(
  segment: string,
  norm: string,
  serviceSupabase: ReturnType<typeof createServiceSupabase> | null,
  serviceClientError: string | null
): Promise<{
  requestedUsername: string;
  normalizedUsername: string;
  hasServiceClient: boolean;
  serviceClientError: string | null;
  publicViewQuery: { ok: boolean; error: string | null; matchedUsername: string | null };
}> {
  let publicViewQuery: { ok: boolean; error: string | null; matchedUsername: string | null } = {
    ok: false,
    error: serviceSupabase ? null : "no client",
    matchedUsername: null,
  };
  if (serviceSupabase) {
    const { data, error } = await serviceSupabase
      .from("public_profile_view")
      .select("username")
      .eq("username", norm)
      .maybeSingle();
    const row = data as { username?: string | null } | null;
    publicViewQuery = {
      ok: !error,
      error: error?.message ?? null,
      matchedUsername: row?.username ?? null,
    };
  }
  return {
    requestedUsername: segment,
    normalizedUsername: norm,
    hasServiceClient: !!serviceSupabase,
    serviceClientError,
    publicViewQuery,
  };
}

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username");
  const debugParam = request.nextUrl.searchParams.get("debug");
  const isDebug = debugParam === "1";
  const segment = (username ?? "").trim();
  if (!segment) {
    return NextResponse.json({ error: "Missing username" }, { status: 400 });
  }

  const norm = normalizeIdentifier(segment);
  if (!norm) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  let serviceSupabase: ReturnType<typeof createServiceSupabase> | null = null;
  let serviceClientError: string | null = null;
  try {
    serviceSupabase = createServiceSupabase();
  } catch (err) {
    serviceClientError = err instanceof Error ? err.message : String(err);
    if (isDebug) {
      const debug = await getDebugPayload(segment, norm, null, serviceClientError);
      return NextResponse.json(
        { error: "Service client unavailable", debug },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: { "Cache-Control": CACHE_404, Vary: "Accept-Encoding" } }
    );
  }

  if (!serviceSupabase) {
    if (isDebug) {
      const debug = await getDebugPayload(segment, norm, null, serviceClientError ?? "createServiceSupabase returned null");
      return NextResponse.json(
        { error: "Service client unavailable", debug },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: { "Cache-Control": CACHE_404, Vary: "Accept-Encoding" } }
    );
  }

  let entity = await getPublicEntityByUsername(norm, serviceSupabase);

  if (entity) {
    entity = await resolveEntityMediaToSignedUrls(entity, serviceSupabase);
  }

  if (!entity) {
    const debug = isDebug ? await getDebugPayload(segment, norm, serviceSupabase, serviceClientError) : undefined;
    return NextResponse.json(
      { error: "Not found", ...(debug && { debug }) },
      { status: 404, headers: { "Cache-Control": CACHE_404, Vary: "Accept-Encoding" } }
    );
  }

  const dto = entityToPublicDTO(entity);

  const ownerId = entity.type === "profile" ? entity.profile?.id : entity.org?.id;
  const revieweeType = entity.type === "profile" ? "profile" : "org";
  const revieweeIdCol = entity.type === "profile" ? "reviewee_profile_id" : "reviewee_org_id";

  let reviewsLatest: PublicProfileApiPayload["reviews"]["latest"] = [];
  let reviewsAverage: number | null = null;
  let reviewsCount = 0;

  if (ownerId) {
    const { data: reviewRows } = await supabase
      .from("reviews")
      .select("id, rating, body, title, created_at, reviewer_profile_id, reviewer_type")
      .eq("reviewee_type", revieweeType)
      .eq(revieweeIdCol, ownerId)
      .eq("verified_deal", true)
      .order("created_at", { ascending: false })
      .limit(10);

    const list = (reviewRows ?? []) as Array<{
      id: string;
      rating: number;
      body: string | null;
      title: string | null;
      created_at: string;
      reviewer_profile_id: string | null;
      reviewer_type: string;
    }>;

    reviewsCount = list.length;
    if (list.length > 0) {
      reviewsAverage = list.reduce((s, r) => s + r.rating, 0) / list.length;
      const latest3 = list.slice(0, 3);
      const ids = latest3
        .filter((r) => r.reviewer_type === "profile" && r.reviewer_profile_id != null)
        .map((r) => r.reviewer_profile_id as string);
      const uniqueIds = [...new Set(ids)];

      let reviewerByProfileId: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
      if (uniqueIds.length > 0) {
        const { data: profiles } = await supabase
          .from("public_profile_view")
          .select("id, display_name, avatar_url")
          .in("id", uniqueIds);
        if (profiles) {
          for (const row of profiles as Array<{ id: string; display_name: string | null; avatar_url: string | null }>) {
            reviewerByProfileId[row.id] = { display_name: row.display_name ?? null, avatar_url: row.avatar_url ?? null };
          }
        }
      }

      reviewsLatest = latest3.map((r) => {
        const reviewer = r.reviewer_type === "profile" && r.reviewer_profile_id ? reviewerByProfileId[r.reviewer_profile_id] : null;
        return {
          rating: r.rating,
          title: r.title ?? null,
          text: r.body ?? null,
          created_at: r.created_at,
          reviewer_display: reviewer?.display_name ?? "Anonymous",
          reviewer_avatar_url: reviewer?.avatar_url ?? null,
          verified_deal: true,
        };
      });
    }
  } else {
    reviewsCount = dto.reviews.length;
    if (dto.reviews.length > 0) {
      reviewsAverage =
        dto.reviews.reduce((s, r) => s + r.rating, 0) / dto.reviews.length;
      reviewsLatest = dto.reviews.slice(0, 3).map((r) => ({
        rating: r.rating,
        title: (r as { title?: string | null }).title ?? null,
        text: r.body ?? null,
        created_at: r.created_at,
        reviewer_display: null as string | null,
        reviewer_avatar_url: null,
        verified_deal: true,
      }));
    }
  }

  if (reviewsAverage === null && dto.reviews.length > 0) {
    reviewsAverage = dto.reviews.reduce((s, r) => s + r.rating, 0) / dto.reviews.length;
    reviewsCount = dto.reviews.length;
    if (reviewsLatest.length === 0) {
      reviewsLatest = dto.reviews.slice(0, 3).map((r) => ({
        rating: r.rating,
        title: (r as { title?: string | null }).title ?? null,
        text: r.body ?? null,
        created_at: r.created_at,
        reviewer_display: null as string | null,
        reviewer_avatar_url: null,
        verified_deal: true,
      }));
    }
  }

  const caseStudies = dto.caseStudies.map((c) => {
    const metrics = (entity!.type === "profile" ? entity!.caseStudies : entity!.caseStudies).find(
      (x) => x.id === c.id
    )?.metrics;
    return {
      id: c.id,
      title: c.title ?? null,
      summary: c.description ?? null,
      tags: metrics ? tagsFromMetrics(metrics) : [],
      url: c.proof_url ?? null,
    };
  });

  // Fetch public skills + achievements for profile (same shape as slug page)
  let skills: PublicProfileApiPayload["skills"] = [];
  let achievements: PublicProfileApiPayload["achievements"] = [];
  if (dto.type === "profile" && ownerId && serviceSupabase) {
    const [skillsRes, achievementsRes] = await Promise.all([
      serviceSupabase
        .from("profile_skills")
        .select("name, level")
        .eq("profile_id", ownerId)
        .eq("is_public", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      serviceSupabase
        .from("profile_achievements")
        .select("title, description, proof_url")
        .eq("profile_id", ownerId)
        .eq("is_public", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
    ]);
    const skillsList = (skillsRes.data ?? []) as Array<{ name: string; level: number | null }>;
    skills = skillsList.map((s) => ({ name: s.name, level: s.level }));
    const achievementsList = (achievementsRes.data ?? []) as Array<{ title: string; description: string | null; proof_url: string | null }>;
    achievements = achievementsList.map((a) => ({ title: a.title, description: a.description ?? null, url: a.proof_url ?? null }));
  }

  if (dto.type === "profile") {
    const layoutObj = dto.publicLayout && typeof dto.publicLayout === "object" ? (dto.publicLayout as { preset?: string; order?: string[]; hidden?: string[]; featured_case_study_id?: string | null; featured_review_id?: string | null; featured_gig_id?: string | null }) : null;
    const layoutPreset: "classic" | "spotlight" | "showcase" | "compact" =
      layoutObj?.preset && ["spotlight", "showcase", "compact"].includes(layoutObj.preset) ? (layoutObj.preset as "spotlight" | "showcase" | "compact") : "classic";
    const payload: PublicProfileApiPayload = {
      profile: {
        username: dto.username,
        display_name: dto.display_name,
        bio: dto.bio,
        avatar_url: dto.avatar_url,
        location: dto.location,
        roles: [],
        is_verified: false,
        ethos_score: dto.ethosScore,
        xscore: dto.xscore,
        reputation_index: dto.linkaryPower ?? null,
        rep_score: (dto as { rep_score?: number | null }).rep_score ?? null,
        public_layout: layoutPreset,
        layout_order: Array.isArray(layoutObj?.order) ? layoutObj.order : null,
        layout_hidden: Array.isArray(layoutObj?.hidden) ? layoutObj.hidden : null,
        featured_case_study_id: layoutObj?.featured_case_study_id ?? null,
        featured_review_id: layoutObj?.featured_review_id ?? null,
        featured_gig_id: layoutObj?.featured_gig_id ?? null,
        profile_type: (entity?.type === "profile" && entity?.profile && "profile_type" in entity.profile
          ? ((entity.profile as { profile_type?: string }).profile_type ?? "individual")
          : "individual") as "individual" | "project" | "company",
      },
      hero: dto.hero ? { hero_image_url: dto.hero.hero_image_url, hero_video_url: dto.hero.hero_video_url, hero_title: dto.hero.hero_title } : null,
      socials: {
        x: dto.socials?.x_url ?? null,
        telegram: dto.socials?.telegram_url ?? null,
        discord: null,
        linkedin: dto.socials?.linkedin_url ?? null,
        website: dto.socials?.website_url ?? dto.website ?? null,
        youtube: dto.socials?.youtube_url ?? null,
      },
      links: (dto.links ?? []).map((l) => ({ title: l.title, url: l.url, icon: l.icon ?? null })),
      team: (dto.team ?? []).map((t) => ({
        name: t.name,
        role: t.role ?? null,
        avatar_url: t.avatar_url ?? null,
        linkedin_url: t.linkedin_url ?? null,
        x_url: t.x_url ?? null,
        website_url: t.website_url ?? null,
        is_public: t.is_public,
      })),
      caseStudies,
      reviews: {
        average: reviewsAverage,
        count: reviewsCount,
        latest: reviewsLatest,
      },
      ...(skills.length > 0 ? { skills } : {}),
      ...(achievements.length > 0 ? { achievements } : {}),
    };

    const body = isDebug
      ? { ...payload, debug: await getDebugPayload(segment, norm, serviceSupabase, serviceClientError) }
      : payload;

    return NextResponse.json(body, {
      headers: {
        "Cache-Control": CACHE_PUBLIC,
        Vary: "Accept-Encoding",
      },
    });
  }

  const orgType = entity?.type === "org" && entity?.org && "org_type" in entity.org ? (entity.org as { org_type?: string }).org_type : null;
  const payload: PublicProfileApiPayload = {
    profile: {
      username: dto.slug,
      display_name: dto.name,
      bio: dto.tagline,
      avatar_url: dto.logo_url,
      location: null,
      roles: [],
      is_verified: false,
      ethos_score: dto.xscore,
      xscore: dto.xscore,
      reputation_index: dto.linkaryInfluence ?? null,
      rep_score: null,
      profile_type: (orgType === "project" ? "project" : "company") as "individual" | "project" | "company",
    },
    socials: {
      x: null,
      telegram: null,
      discord: null,
      linkedin: null,
      website: dto.website ?? null,
      youtube: null,
    },
    links: [],
    caseStudies,
    reviews: {
      average: reviewsAverage,
      count: reviewsCount,
      latest: reviewsLatest,
    },
  };

  const body = isDebug
    ? { ...payload, debug: await getDebugPayload(segment, norm, serviceSupabase, serviceClientError) }
    : payload;

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": CACHE_PUBLIC,
      Vary: "Accept-Encoding",
    },
  });
}
