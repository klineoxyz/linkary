/**
 * GET /api/me/public-preview?slug=...
 * Auth required. Returns the same DTO shape as /api/public/profile for the current user's profile
 * (owner preview when unpublished). Verify slug matches profile.username or profile.twitter_username; else 403.
 * No private fields (email, wallet). Cache-Control: no-store.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getPublicEntityForOwner } from "@/lib/publicData";
import { entityToPublicDTO } from "@/lib/publicProfileDTO";
import { resolveEntityMediaToSignedUrls } from "@/lib/resolveEntityMediaUrls";
import type { PublicProfileApiPayload } from "@/app/api/public/profile/route";
import { createServiceSupabase } from "@/lib/x-analytics-server";

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/^@/, "");
}

function tagsFromMetrics(metrics: unknown): string[] {
  if (metrics == null || typeof metrics !== "object") return [];
  const m = metrics as Record<string, unknown>;
  const t = m.tags ?? m.tag;
  if (Array.isArray(t) && t.every((x) => typeof x === "string")) return t as string[];
  return [];
}

export async function GET(request: NextRequest) {
  const slugRaw = request.nextUrl.searchParams.get("slug");
  const slug = slugRaw ? normalize(slugRaw) : "";
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const supabaseServer = await createServerSupabase();
  const { data: { user }, error: userError } = await supabaseServer.auth.getUser();
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("id, username, twitter_username")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Forbidden" }, {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const row = profile as { username?: string | null; twitter_username?: string | null };
  const usernameNorm = (row.username ?? "").trim().toLowerCase().replace(/^@/, "");
  const twitterNorm = (row.twitter_username ?? "").trim().toLowerCase().replace(/^@/, "");
  const matches = usernameNorm === slug || twitterNorm === slug;
  if (!matches) {
    return NextResponse.json({ error: "Forbidden" }, {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let serviceSupabase: ReturnType<typeof createServiceSupabase> | null = null;
  try {
    serviceSupabase = createServiceSupabase();
  } catch {
    return NextResponse.json({ error: "Service unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let entity = await getPublicEntityForOwner(slug, user.id, serviceSupabase);
  if (!entity || entity.type !== "profile") {
    return NextResponse.json({ error: "Not found" }, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  entity = await resolveEntityMediaToSignedUrls(entity, serviceSupabase);
  const dto = entityToPublicDTO(entity);
  if (dto.type !== "profile") {
    return NextResponse.json({ error: "Not found" }, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const ownerId = entity.profile?.id;
  let reviewsLatest: PublicProfileApiPayload["reviews"]["latest"] = [];
  let reviewsAverage: number | null = null;
  let reviewsCount = 0;

  if (ownerId) {
    const { data: reviewRows } = await supabase
      .from("reviews")
      .select("id, rating, body, title, created_at, reviewer_profile_id, reviewer_type")
      .eq("reviewee_type", "profile")
      .eq("reviewee_profile_id", ownerId)
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

      let displayByProfileId: Record<string, string> = {};
      if (uniqueIds.length > 0) {
        const { data: profiles } = await serviceSupabase
          .from("public_profile_view")
          .select("id, display_name")
          .in("id", uniqueIds);
        if (profiles) {
          for (const row of profiles as Array<{ id: string; display_name: string | null }>) {
            displayByProfileId[row.id] = row.display_name ?? "Anonymous";
          }
        }
      }

      reviewsLatest = latest3.map((r) => ({
        rating: r.rating,
        text: r.body ?? null,
        created_at: r.created_at,
        reviewer_display:
          r.reviewer_type === "profile" && r.reviewer_profile_id
            ? displayByProfileId[r.reviewer_profile_id] ?? "Anonymous"
            : "Anonymous",
      }));
    }
  }

  if (reviewsAverage === null && dto.reviews.length > 0) {
    reviewsAverage = dto.reviews.reduce((s, r) => s + r.rating, 0) / dto.reviews.length;
    reviewsCount = dto.reviews.length;
    if (reviewsLatest.length === 0) {
      reviewsLatest = dto.reviews.slice(0, 3).map((r) => ({
        rating: r.rating,
        text: r.body ?? null,
        created_at: r.created_at,
        reviewer_display: null as string | null,
      }));
    }
  }

  const caseStudies = dto.caseStudies.map((c) => {
    const metrics = entity.caseStudies.find((x) => x.id === c.id)?.metrics;
    return {
      id: c.id,
      title: c.title ?? null,
      summary: c.description ?? null,
      tags: metrics ? tagsFromMetrics(metrics) : [],
      url: c.proof_url ?? null,
    };
  });

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
    },
    socials: {
      x: dto.socials?.x_url ?? null,
      telegram: dto.socials?.telegram_url ?? null,
      discord: null,
      linkedin: dto.socials?.linkedin_url ?? null,
      website: dto.socials?.website_url ?? dto.website ?? null,
    },
    links: [],
    caseStudies,
    reviews: {
      average: reviewsAverage,
      count: reviewsCount,
      latest: reviewsLatest,
    },
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
