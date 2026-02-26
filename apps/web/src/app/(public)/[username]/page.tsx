import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getIdentifierKind, normalizeIdentifier, resolvePublicEntity } from "@/lib/entityResolver";
import { isReservedPath } from "@/lib/reservedPaths";
import { getPublicDTOByUsername } from "@/lib/getPublicDTO";
import { dtoToEntityView, entityToPublicDTO } from "@/lib/publicProfileDTO";
import { resolveEntityMediaToSignedUrls } from "@/lib/resolveEntityMediaUrls";
import { computeReputationIndex } from "@/lib/reputationIndex";
import AppWithProviders from "../../AppWithProviders";
import type { PublicProfileApiPayload } from "@/app/api/public/profile/route";
import { PublicProfileContent } from "./PublicProfileContent";
import { PublicOnePagerWrapper } from "./PublicOnePagerWrapper";
import { NotFoundClaimView } from "./NotFoundClaimView";

type Props = { params: Promise<{ username: string }>; searchParams?: Promise<{ view?: string; debug?: string }> };

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://linkary.xyz");
}

function tagsFromMetrics(metrics: unknown): string[] {
  if (metrics == null || typeof metrics !== "object") return [];
  const m = metrics as Record<string, unknown>;
  const t = m.tags ?? m.tag;
  if (Array.isArray(t) && t.every((x) => typeof x === "string")) return t as string[];
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const segment = (username ?? "").trim();
  const segmentLower = normalizeIdentifier(segment);
  if (!segment || isReservedPath(segmentLower)) {
    return { title: "Linkary" };
  }
  const kind = getIdentifierKind(segment);
  let serviceSupabase: import("@supabase/supabase-js").SupabaseClient | null = null;
  if (kind === "wallet" || kind === "slug") {
    try {
      const { createServiceSupabase } = await import("@/lib/x-analytics-server");
      serviceSupabase = createServiceSupabase();
    } catch {
      /* skip */
    }
  }
  let title = "Linkary";
  let description = "Link-in-bio and credibility hub.";
  let published = true;
  const url = `${baseUrl()}/${encodeURIComponent(segment)}`;
  if (kind === "slug" && serviceSupabase) {
    const [u, t] = await Promise.all([
      serviceSupabase.from("profiles").select("id, username, twitter_username, published").ilike("username", segmentLower).maybeSingle(),
      serviceSupabase.from("profiles").select("id, username, twitter_username, published").ilike("twitter_username", segmentLower).maybeSingle(),
    ]);
    const row = (u.data ?? t.data) as { id: string; username?: string | null; twitter_username?: string | null; published?: boolean } | null;
    if (row) {
      published = row.published === true;
      if (published) {
        const { data: viewRow } = await serviceSupabase
          .from("public_profile_view")
          .select("display_name, username, bio")
          .eq("id", row.id)
          .maybeSingle();
        const v = viewRow as { display_name?: string | null; username?: string | null; bio?: string | null } | null;
        if (v) {
          title = `${v.display_name || v.username || segment} on Linkary`;
          if (v.bio && typeof v.bio === "string") {
            description = v.bio.length > 160 ? v.bio.slice(0, 157) + "…" : v.bio;
          }
        }
      }
    } else {
      published = false;
    }
  } else if (kind === "slug") {
    published = false;
  } else {
    const entity = await resolvePublicEntity(segment, { serviceSupabase: serviceSupabase ?? undefined });
    if (entity) {
      const name = entity.type === "profile"
        ? (entity.profile?.display_name ?? entity.profile?.username ?? entity.profile?.twitter_username ?? segment)
        : entity.org?.name ?? segment;
      title = `${name} on Linkary`;
      const bio = entity.type === "profile" ? entity.profile?.bio : entity.org?.tagline;
      if (bio && typeof bio === "string") {
        description = bio.length > 160 ? bio.slice(0, 157) + "…" : bio;
      }
    } else {
      published = false;
    }
  }
  const ogImage = `${baseUrl()}/api/og?username=${encodeURIComponent(segment)}`;
  const trimmedTitle = (title ?? "Linkary").trim().slice(0, 100);
  const trimmedDesc = (description ?? "Link-in-bio and credibility hub.").trim().slice(0, 160);

  return {
    title: trimmedTitle,
    description: trimmedDesc,
    alternates: { canonical: url },
    robots: published ? undefined : { index: false, follow: false },
    openGraph: {
      title: trimmedTitle,
      description: trimmedDesc,
      url,
      siteName: "Linkary",
      images: [{ url: ogImage, width: 1200, height: 630, alt: trimmedTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: trimmedTitle,
      description: trimmedDesc,
      images: [ogImage],
    },
  };
}

export const dynamic = "force-dynamic";

/**
 * Public URL: /[identifier] — slug, UUID, X handle, or wallet.
 * Slug branch: queries public_profile_view + related data server-side with service role (no fetch to API).
 */
export default async function PublicUsernamePage({ params, searchParams }: Props) {
  const { username } = await params;
  const resolvedSearchParams = await searchParams;
  const viewBrochure = resolvedSearchParams?.view === "brochure";
  const isDebug = resolvedSearchParams?.debug === "1";
  const segment = (username ?? "").trim();
  if (!segment) notFound();

  const segmentLower = normalizeIdentifier(segment);
  if (isReservedPath(segmentLower)) {
    return <AppWithProviders />;
  }

  const kind = getIdentifierKind(segment);

  if (kind === "slug") {
    let serviceSupabase: ReturnType<typeof import("@/lib/x-analytics-server").createServiceSupabase>;
    try {
      const { createServiceSupabase } = await import("@/lib/x-analytics-server");
      serviceSupabase = createServiceSupabase();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isDebug) {
        return (
          <div className="min-h-screen bg-background p-6">
            <p className="text-destructive">Something went wrong loading this profile.</p>
            <pre className="mt-4 rounded bg-muted p-4 text-xs overflow-auto">
              {JSON.stringify({ error: message, requestedUsername: segment, normalizedUsername: segmentLower }, null, 2)}
            </pre>
          </div>
        );
      }
      return <NotFoundClaimView requestedUsername={segmentLower} />;
    }

    try {
      const minimalCols = "id, username, twitter_username, published";
      const [byUsername, byTwitter] = await Promise.all([
        serviceSupabase.from("profiles").select(minimalCols).ilike("username", segmentLower).maybeSingle(),
        serviceSupabase.from("profiles").select(minimalCols).ilike("twitter_username", segmentLower).maybeSingle(),
      ]);
      const minimalRow = (byUsername.data ?? byTwitter.data) as {
        id: string;
        username?: string | null;
        twitter_username?: string | null;
        published?: boolean;
      } | null;
      const matchedBy = byUsername.data ? "username" : byTwitter.data ? "twitter_username" : null;

      if (!minimalRow) {
        return <NotFoundClaimView requestedUsername={segmentLower} />;
      }

      const profileId = minimalRow.id;
      const isPublished = minimalRow.published === true;
      let isOwner = false;
      if (!isPublished) {
        const { createServerSupabase } = await import("@/lib/supabase/server");
        const serverSupabase = await createServerSupabase();
        const { data: { user } } = await serverSupabase.auth.getUser();
        isOwner = user?.id === profileId;
        if (!isOwner) {
          return <NotFoundClaimView requestedUsername={segmentLower} />;
        }
      }

      const isUnpublished = !isPublished;

      const viewCols = "id, username, twitter_username, display_name, bio, avatar_url, location, website, followers_total, avg_engagement_rate, xscore, profile_type, hero_image_url, hero_video_url, hero_title";
      const profileDisplaySource = isPublished
        ? await serviceSupabase.from("public_profile_view").select(viewCols).eq("id", profileId).maybeSingle()
        : await serviceSupabase.from("profiles").select(viewCols + ", show_reviews, token_dexscreener_url").eq("id", profileId).maybeSingle();
      const profileRow = profileDisplaySource.data as {
        id: string;
        username?: string | null;
        twitter_username?: string | null;
        display_name?: string | null;
        bio?: string | null;
        avatar_url?: string | null;
        location?: string | null;
        website?: string | null;
        followers_total?: number;
        avg_engagement_rate?: number;
        xscore?: number | null;
        profile_type?: string | null;
        hero_image_url?: string | null;
        hero_video_url?: string | null;
        hero_title?: string | null;
        show_reviews?: boolean | null;
        token_dexscreener_url?: string | null;
      } | null;

      if (!profileRow) {
        return <NotFoundClaimView requestedUsername={segmentLower} />;
      }

      const [profileExtRow, socialsRow, reviewRows, caseRows, linksRows, relationsRows, skillsRows, achievementsRows] = await Promise.all([
        isPublished
          ? serviceSupabase.from("profiles").select("show_reviews, token_dexscreener_url").eq("id", profileId).maybeSingle()
          : Promise.resolve({ data: { show_reviews: profileRow.show_reviews, token_dexscreener_url: profileRow.token_dexscreener_url } as { show_reviews?: boolean | null; token_dexscreener_url?: string | null } }),
        serviceSupabase.from("profile_socials").select("x_url, linkedin_url, website_url, telegram_url").eq("profile_id", profileId).maybeSingle(),
        serviceSupabase.from("reviews").select("id, rating, body, title, created_at, reviewer_profile_id, reviewer_type, verified_deal").eq("reviewee_type", "profile").eq("reviewee_profile_id", profileId).eq("verified_deal", true).order("created_at", { ascending: false }).limit(10),
        serviceSupabase.from("case_studies").select("id, title, description, proof_url, metrics, created_at").eq("owner_type", "profile").eq("owner_profile_id", profileId).eq("is_public", true).order("created_at", { ascending: false }).limit(20),
        serviceSupabase.from("profile_links").select("title, url, icon").eq("profile_id", profileId).eq("is_public", true).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
        serviceSupabase.from("profile_relations").select("source_profile_id, target_profile_id, relation_type, sort_order").or(`source_profile_id.eq.${profileId},target_profile_id.eq.${profileId}`).eq("is_public", true).order("relation_type").order("sort_order", { ascending: true }),
        serviceSupabase.from("profile_skills").select("name, level").eq("profile_id", profileId).eq("is_public", true).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
        serviceSupabase.from("profile_achievements").select("title, description, proof_url").eq("profile_id", profileId).eq("is_public", true).order("sort_order", { ascending: true }).order("created_at", { ascending: true }),
      ]);

      const ext = profileExtRow.data as { show_reviews?: boolean | null; token_dexscreener_url?: string | null } | null;
      const profileType = (profileRow.profile_type === "project" || profileRow.profile_type === "company" ? profileRow.profile_type : "individual") as "individual" | "project" | "company";
      const heroImageUrl = profileRow.hero_image_url ?? null;
      const heroVideoUrl = profileRow.hero_video_url ?? null;
      const heroTitle = profileRow.hero_title ?? null;
      const showReviews = ext?.show_reviews !== false;
      const tokenDexscreenerUrl = (ext?.token_dexscreener_url ?? "").trim();

      let teamList: Array<{ name: string; role: string | null; avatar_url: string | null; linkedin_url?: string | null; x_url?: string | null; website_url?: string | null; is_public: boolean }> = [];
      if (profileType === "company") {
        try {
          const teamRes = await serviceSupabase
            .from("org_team_members")
            .select("name, role, avatar_url, linkedin_url, x_url, website_url, is_public")
            .eq("org_profile_id", profileId)
            .eq("is_public", true)
            .order("sort_order", { ascending: true });
          teamList = (teamRes.data ?? []) as typeof teamList;
        } catch {
          teamList = [];
        }
      }

      const socials = socialsRow.data as { x_url?: string | null; linkedin_url?: string | null; website_url?: string | null; telegram_url?: string | null } | null;
      const reviewsList = (reviewRows.data ?? []) as Array<{
        id: string;
        rating: number;
        body: string | null;
        title: string | null;
        created_at: string;
        reviewer_profile_id: string | null;
        reviewer_type: string;
        verified_deal?: boolean;
      }>;
      const caseStudiesList = (caseRows.data ?? []) as Array<{ id: string; title: string | null; description: string | null; proof_url: string | null; metrics: unknown; created_at: string }>;

      let reviewsAverage: number | null = null;
      let reviewsLatest: PublicProfileApiPayload["reviews"]["latest"] = [];
      if (reviewsList.length > 0) {
        reviewsAverage = reviewsList.reduce((s, r) => s + r.rating, 0) / reviewsList.length;
        const latest3 = reviewsList.slice(0, 3);
        const reviewerIds = [...new Set(latest3.filter((r) => r.reviewer_type === "profile" && r.reviewer_profile_id).map((r) => r.reviewer_profile_id as string))];
        let reviewerByProfileId: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
        if (reviewerIds.length > 0) {
          const { data: profiles } = await serviceSupabase.from("public_profile_view").select("id, display_name, avatar_url").in("id", reviewerIds);
          if (profiles) {
            for (const p of profiles as Array<{ id: string; display_name: string | null; avatar_url: string | null }>) {
              reviewerByProfileId[p.id] = { display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null };
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
            verified_deal: r.verified_deal ?? true,
          };
        });
      }

      let reputationIndex: number;
      try {
        reputationIndex = await computeReputationIndex(profileId, serviceSupabase, { debug: isDebug });
      } catch {
        reputationIndex = 0;
      }

      const caseStudies = caseStudiesList.map((c) => ({
        id: c.id,
        title: c.title ?? null,
        summary: c.description ?? null,
        tags: tagsFromMetrics(c.metrics),
        url: c.proof_url ?? null,
      }));

      const skillsList = (skillsRows.data ?? []) as Array<{ name: string; level: number | null }>;
      const skills = skillsList.map((s) => ({ name: s.name, level: s.level }));

      const achievementsList = (achievementsRows.data ?? []) as Array<{ title: string; description: string | null; proof_url: string | null }>;
      const achievements = achievementsList.map((a) => ({ title: a.title, description: a.description ?? null, url: a.proof_url ?? null }));

      let resolvedHeroImageUrl: string | null = heroImageUrl;
      if (heroImageUrl && typeof heroImageUrl === "string" && heroImageUrl.startsWith("profile/")) {
        const { createSignedUrlForPath } = await import("@/lib/mediaSignedUrlServer");
        resolvedHeroImageUrl = await createSignedUrlForPath(serviceSupabase, heroImageUrl) ?? heroImageUrl;
      }

      let tokenPayload: PublicProfileApiPayload["token"] = null;
      if (profileType === "project" && tokenDexscreenerUrl.startsWith("https://") && tokenDexscreenerUrl.includes("dexscreener.com/")) {
        try {
          const { parseDexscreenerUrl, fetchDexscreenerPair } = await import("@/lib/dexscreener");
          const parsed = parseDexscreenerUrl(tokenDexscreenerUrl);
          if (parsed) {
            const token = await fetchDexscreenerPair(parsed.chainId, parsed.pairAddress, tokenDexscreenerUrl);
            tokenPayload = token;
          }
        } catch {
          tokenPayload = null;
        }
      }

      type RelationRow = { source_profile_id: string; target_profile_id: string; relation_type: string; sort_order: number };
      const relationsList = (relationsRows.data ?? []) as RelationRow[];
      const partnerIds = new Set<string>();
      for (const r of relationsList) {
        if (r.source_profile_id === profileId) partnerIds.add(r.target_profile_id);
        else partnerIds.add(r.source_profile_id);
      }
      let partnerProfiles: Record<string, { id: string; username: string; display_name: string | null; avatar_url: string | null; profile_type: string }> = {};
      if (partnerIds.size > 0) {
        const { data: partners } = await serviceSupabase.from("public_profile_view").select("id, username, display_name, avatar_url, profile_type").in("id", [...partnerIds]);
        for (const p of (partners ?? []) as Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null; profile_type: string | null }>) {
          const username = (p.username ?? "").trim();
          if (username) partnerProfiles[p.id] = { id: p.id, username, display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null, profile_type: (p.profile_type ?? "individual") as string };
        }
      }
      type RelationCard = { id: string; username: string; display_name: string | null; avatar_url: string | null; profile_type: string };
      const relationCard = (id: string): RelationCard | undefined => partnerProfiles[id];
      const ambassadorOf: RelationCard[] = [];
      const affiliateOf: RelationCard[] = [];
      const ambassadors: RelationCard[] = [];
      const affiliates: RelationCard[] = [];
      const ecosystemProjects: RelationCard[] = [];
      const subsidiaries: RelationCard[] = [];
      for (const r of relationsList) {
        const partner = r.source_profile_id === profileId ? relationCard(r.target_profile_id) : relationCard(r.source_profile_id);
        if (!partner) continue;
        if (profileType === "individual") {
          if (r.source_profile_id === profileId && r.relation_type === "ambassador") ambassadorOf.push(partner);
          if (r.source_profile_id === profileId && r.relation_type === "affiliate") affiliateOf.push(partner);
        } else {
          if (r.target_profile_id === profileId && r.relation_type === "ambassador") ambassadors.push(partner);
          if (r.target_profile_id === profileId && r.relation_type === "affiliate") affiliates.push(partner);
          if (r.source_profile_id === profileId && r.relation_type === "ecosystem") ecosystemProjects.push(partner);
          if (r.source_profile_id === profileId && r.relation_type === "subsidiary") subsidiaries.push(partner);
        }
      }
      const relationsPayload: NonNullable<PublicProfileApiPayload["relations"]> = {};
      if (profileType === "individual") {
        if (ambassadorOf.length) relationsPayload.ambassadorOf = ambassadorOf;
        if (affiliateOf.length) relationsPayload.affiliateOf = affiliateOf;
      } else {
        if (ambassadors.length) relationsPayload.ambassadors = ambassadors;
        if (affiliates.length) relationsPayload.affiliates = affiliates;
        if (ecosystemProjects.length) relationsPayload.ecosystemProjects = ecosystemProjects;
        if (subsidiaries.length) relationsPayload.subsidiaries = subsidiaries;
      }

      let gigsPayload: PublicProfileApiPayload["gigs"] = [];
      if (profileType === "project" || profileType === "company") {
        const gigsRes = await serviceSupabase
          .from("gigs")
          .select("id, title, description, gig_type, compensation_type, budget_text, location, remote, created_at")
          .eq("owner_profile_id", profileId)
          .eq("is_public", true)
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(20);
        gigsPayload = (gigsRes.data ?? []) as PublicProfileApiPayload["gigs"];
      }

      const payload: PublicProfileApiPayload = {
        profile: {
          username: profileRow.username ?? profileRow.twitter_username ?? null,
          display_name: profileRow.display_name ?? null,
          bio: profileRow.bio ?? null,
          avatar_url: profileRow.avatar_url ?? null,
          location: profileRow.location ?? null,
          roles: [],
          is_verified: false,
          ethos_score: null,
          xscore: profileRow.xscore ?? null,
          reputation_index: reputationIndex,
          profile_type: profileType,
        },
        hero:
          resolvedHeroImageUrl || heroVideoUrl || heroTitle
            ? {
                hero_image_url: resolvedHeroImageUrl,
                hero_video_url: heroVideoUrl,
                hero_title: heroTitle,
              }
            : null,
        team: teamList.map((t) => ({
          name: t.name,
          role: t.role ?? null,
          avatar_url: t.avatar_url ?? null,
          linkedin_url: t.linkedin_url ?? null,
          x_url: t.x_url ?? null,
          website_url: t.website_url ?? null,
          is_public: t.is_public,
        })),
        socials: {
          x: socials?.x_url ?? null,
          telegram: socials?.telegram_url ?? null,
          discord: null,
          linkedin: socials?.linkedin_url ?? null,
          website: socials?.website_url ?? profileRow.website ?? null,
        },
        links: ((linksRows.data ?? []) as Array<{ title: string; url: string; icon?: string | null }>).map((l) => ({
          title: l.title,
          url: l.url,
          icon: l.icon ?? undefined,
        })),
        caseStudies,
        reviews: {
          average: reviewsAverage,
          count: reviewsList.length,
          latest: reviewsLatest,
        },
        show_reviews: showReviews,
        token: tokenPayload,
        ...(Object.keys(relationsPayload).length > 0 ? { relations: relationsPayload } : {}),
        ...(gigsPayload.length > 0 ? { gigs: gigsPayload } : {}),
        ...(skills.length > 0 ? { skills } : {}),
        ...(achievements.length > 0 ? { achievements } : {}),
      };

      const displayUsername = payload.profile.username ?? segmentLower;

      const profileUrl = `${baseUrl().replace(/\/$/, "")}/${encodeURIComponent(displayUsername)}`;
      return (
        <div className="min-h-screen bg-background text-foreground font-sans">
          {isUnpublished && (
            <div className="bg-muted/80 border-b border-border px-4 py-2.5 text-center text-sm text-muted-foreground">
              This profile is not published yet.
            </div>
          )}
          <PublicProfileContent data={payload} username={displayUsername} profileUrl={profileUrl} />
          {isDebug && (
            <pre className="mx-auto max-w-xl px-4 py-6 text-xs text-muted-foreground overflow-auto rounded bg-muted p-4 mt-4">
              {JSON.stringify(
                {
                  requestedUsername: segment,
                  normalizedUsername: segmentLower,
                  matchedBy,
                  profile_id: profileId,
                  counts: { reviewsCount: reviewsList.length, caseStudiesCount: caseStudiesList.length },
                  reputation_index: reputationIndex,
                  token: tokenPayload ? "present" : "null",
                },
                null,
                2
              )}
            </pre>
          )}
        </div>
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isDebug) {
        return (
          <div className="min-h-screen bg-background p-6">
            <p className="text-destructive">Something went wrong loading this profile.</p>
            <pre className="mt-4 rounded bg-muted p-4 text-xs overflow-auto">{message}</pre>
          </div>
        );
      }
      return <NotFoundClaimView requestedUsername={segmentLower} />;
    }
  }

  let serviceSupabase: import("@supabase/supabase-js").SupabaseClient | null = null;
  try {
    const { createServiceSupabase } = await import("@/lib/x-analytics-server");
    serviceSupabase = createServiceSupabase();
  } catch {
    /* no service key; wallet resolution and media signed URLs skipped */
  }

  let entity = await resolvePublicEntity(segment, { serviceSupabase: serviceSupabase ?? undefined });
  if (!entity) {
    if (kind === "wallet") notFound();
    return <NotFoundClaimView requestedUsername={segmentLower} />;
  }
  if (serviceSupabase) {
    entity = await resolveEntityMediaToSignedUrls(entity, serviceSupabase);
  }

  const dto = entityToPublicDTO(entity);
  const entityView = dtoToEntityView(dto);
  const canonicalUsername =
    entity.type === "profile"
      ? (entity.profile?.username ?? entity.profile?.twitter_username ?? "").replace(/^@/, "").toLowerCase()
      : (entity.org?.slug ?? "").toLowerCase();
  return (
    <PublicOnePagerWrapper
      entityView={entityView}
      username={canonicalUsername || segmentLower}
      analyticsSource={dto.analytics.source}
      analyticsInitialized={dto.analytics.initialized}
      hasXConnected={entity.type === "profile" && !!entity.profile?.twitter_username}
      brochure={viewBrochure}
    />
  );
}
