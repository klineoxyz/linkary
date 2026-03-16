/**
 * GET /api/public/profile?username=...
 * Returns a single public-safe JSON payload for the Linktree-style public profile page.
 * No private analytics (followers/engagement snapshot); only proof numbers (ethos, xscore, reputation).
 * Cache: s-maxage=300, stale-while-revalidate=3600.
 */
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getPublicEntityByUsername } from "@/lib/publicData";
import { normalizeIdentifier } from "@/lib/entityResolver";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { resolveEntityMediaToSignedUrls } from "@/lib/resolveEntityMediaUrls";
import { buildPublicProfilePayloadFromEntity } from "@/lib/buildPublicProfilePayload";

const CACHE_PUBLIC = "s-maxage=300, stale-while-revalidate=3600";
const CACHE_404 = "s-maxage=30, stale-while-revalidate=60";

export type PublicProfileApiPayload = {
  profile: {
    username: string | null;
    display_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    /** Only shown on public page when true (advance editor: "Show location on public profile"). */
    show_location?: boolean;
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
  caseStudies: Array<{ id: string; title: string | null; summary: string | null; tags: string[]; url: string | null; imageUrl?: string | null; /** True when linked to completed deal/gig_deal (no ids exposed). */ from_verified_work?: boolean }>;
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

  if (process.env.E2E_FIXTURE_USERNAME && norm === process.env.E2E_FIXTURE_USERNAME) {
    const { e2eProofFixture } = await import("@/lib/e2ePublicProfileFixture");
    return NextResponse.json(e2eProofFixture, {
      headers: { "Cache-Control": CACHE_PUBLIC, Vary: "Accept-Encoding" },
    });
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

  const payload = await buildPublicProfilePayloadFromEntity(entity, serviceSupabase);
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
