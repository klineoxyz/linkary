/**
 * Server-only: build PublicProfileApiPayload from an already-resolved PublicEntity.
 * Used by GET /api/public/profile and by the [username] page so the optimized UI
 * is rendered without depending on an internal fetch (which can fail in SSR).
 */
import "server-only";

import type { PublicProfileApiPayload } from "@/app/api/public/profile/route";
import type { PublicEntity } from "@/lib/publicData";
import { entityToPublicDTO } from "@/lib/publicProfileDTO";
import { supabase } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

function tagsFromMetrics(metrics: unknown): string[] {
  if (metrics == null || typeof metrics !== "object") return [];
  const m = metrics as Record<string, unknown>;
  const t = m.tags ?? m.tag;
  if (Array.isArray(t) && t.every((x) => typeof x === "string")) return t as string[];
  return [];
}

export async function buildPublicProfilePayloadFromEntity(
  entity: PublicEntity,
  serviceSupabase: SupabaseClient
): Promise<PublicProfileApiPayload> {
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
    const metrics = (entity.type === "profile" ? entity.caseStudies : entity.caseStudies).find(
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
    const profileRow = entity.type === "profile" ? (entity.profile as { ethos_score?: number | null; xscore?: number | null; rep_score?: number | null } | undefined) : undefined;
    const ethosFromView = profileRow?.ethos_score ?? null;
    const xscoreFromView = profileRow?.xscore ?? null;
    const repScoreFromView = profileRow?.rep_score ?? null;
    return {
      profile: {
        username: dto.username,
        display_name: dto.display_name,
        bio: dto.bio,
        avatar_url: dto.avatar_url,
        location: dto.location,
        roles: [],
        is_verified: false,
        ethos_score: dto.ethosScore ?? ethosFromView,
        xscore: dto.xscore ?? xscoreFromView,
        reputation_index: dto.linkaryPower ?? null,
        rep_score: dto.rep_score ?? repScoreFromView,
        public_layout: layoutPreset,
        layout_order: Array.isArray(layoutObj?.order) ? layoutObj.order : null,
        layout_hidden: Array.isArray(layoutObj?.hidden) ? layoutObj.hidden : null,
        featured_case_study_id: layoutObj?.featured_case_study_id ?? null,
        featured_review_id: layoutObj?.featured_review_id ?? null,
        featured_gig_id: layoutObj?.featured_gig_id ?? null,
        profile_type: (entity.type === "profile" && entity.profile && "profile_type" in entity.profile
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
  }

  const orgType = entity.type === "org" && entity.org && "org_type" in entity.org ? (entity.org as { org_type?: string }).org_type : null;
  return {
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
}
