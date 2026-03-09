import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
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
import { OwnerUnpublishedProfile } from "./OwnerUnpublishedProfile";

/**
 * PUBLIC PROFILE FIELD MAPPING
 * Ensures every field edited in ProfileEditPage is visible on /{username}.
 *
 * | Section/Field           | Source (table.column)           | Edited (ProfileEditPage)     | Fetched (this page)                    | Rendered (PublicProfileContent)     |
 * |--------------------------|----------------------------------|------------------------------|----------------------------------------|-------------------------------------|
 * | display_name             | profiles (via view)              | Basics / display_name        | displayView select viewCols            | profile.display_name, header        |
 * | bio                      | profiles (via view)              | Basics / bio                 | displayView                            | profile.bio                         |
 * | avatar_url               | profiles (via view)              | Basics / avatar              | displayView                            | profile.avatar_url, header           |
 * | location                 | profiles (via view)             | Basics / location            | displayView                            | profile.location                    |
 * | website                  | profiles (via view)             | Basics / website             | displayView; also profile_socials      | socials.website (fallback)          |
 * | twitter_username         | profiles (via view)             | Username/handle              | displayView; used for slug match       | handle fallback, @handle             |
 * | profile_type             | profiles (via view)             | Profile type selector        | displayView                            | profile.profile_type, badge         |
 * | hero_image_url           | profiles (via view)             | Hero / image                 | displayView                            | hero.hero_image_url                 |
 * | hero_video_url           | profiles (via view)             | Hero / video                 | displayView                            | hero.hero_video_url                 |
 * | hero_title               | profiles (via view)             | Hero / title                 | displayView                            | hero.hero_title                     |
 * | socials (x, telegram, …) | profile_socials                 | Social links section         | profile_socials select                 | socialLinks (X, Telegram, Discord, LinkedIn, Website, YouTube) |
 * | links                    | profile_links                   | Links section                | profile_links (is_public)             | links[]                             |
 * | skills/services          | profile_skills                  | Skills section               | profile_skills (is_public)            | skills[]                            |
 * | achievements             | profile_achievements            | Achievements section         | profile_achievements (is_public)       | achievements[]                      |
 * | case_studies             | case_studies                    | Case studies section         | case_studies (is_public)               | caseStudies[]                       |
 * | relations                | profile_relations               | Relations section            | profile_relations (is_public) + view   | relations (ambassador/affiliate/…)  |
 * | gigs                     | gigs                            | Gigs section                 | gigs (is_public, status=open)          | data.gigs[]                         |
 * | team                     | org_team_members                | Team section (company)      | org_team_members (is_public)           | team[]                              |
 * | token_dexscreener_url    | profiles                        | Token URL (project)          | profiles select show_reviews, token_* | token card (Dexscreener)            |
 * | show_reviews             | profiles                        | Reviews toggle               | profiles select                        | show_reviews → Reviews section      |
 * | reviews                  | reviews                         | (received only)              | reviews when show_reviews              | reviews.latest, average, count       |
 * | reputation_index         | computed                        | (computed from activity)     | computeReputationIndex()               | profile.reputation_index, Proof     |
 * | xscore                   | profiles (via view, gated)      | (X insights)                 | displayView                            | profile.xscore, Proof               |
 *
 * Views: public_profile_view (published only), public_profile_preview_view (same columns, service_role only).
 * Gaps fixed: profile_socials.youtube_url was not fetched → added; socials.youtube added to payload and render.
 * Not in scope: public_layout (section order) — in views but not yet used for ordering on public page.
 */

type Props = { params: Promise<{ username: string }>; searchParams?: Promise<{ view?: string; debug?: string }> };

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://linkary.xyz");
}

/** Canonical site base for "Copy profile link" so the copied URL is always the production domain (set NEXT_PUBLIC_APP_URL=https://linkary.xyz). */
function canonicalBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://linkary.xyz").replace(/\/$/, "");
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
  if (!segment) {
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
  let canonicalSlug: string = segmentLower;
  if (kind === "slug" && serviceSupabase) {
    const { getPublicEntityByUsername } = await import("@/lib/publicData");
    const entity = await getPublicEntityByUsername(segmentLower, serviceSupabase);
    if (entity) {
      if (entity.type === "profile" && entity.profile) {
        const p = entity.profile;
        canonicalSlug = (p.username ?? p.twitter_username ?? "").replace(/^@/, "").toLowerCase() || segmentLower;
        published = p.published === true;
        if (published) {
          title = `${p.display_name || p.username || p.twitter_username || segment} on Linkary`;
          if (p.bio && typeof p.bio === "string") {
            description = p.bio.length > 160 ? p.bio.slice(0, 157) + "…" : p.bio;
          }
        }
      } else if (entity.type === "org" && entity.org) {
        const o = entity.org;
        canonicalSlug = (o.slug ?? "").toLowerCase() || segmentLower;
        title = `${o.name || segment} on Linkary`;
        if (o.tagline && typeof o.tagline === "string") {
          description = o.tagline.length > 160 ? o.tagline.slice(0, 157) + "…" : o.tagline;
        }
      }
    } else {
      published = false;
      if (isReservedPath(segmentLower)) {
        return {
          title: "Linkary",
          robots: { index: false, follow: false },
        };
      }
    }
  } else if (kind === "slug") {
    published = false;
    if (isReservedPath(segmentLower)) {
      return { title: "Linkary", robots: { index: false, follow: false } };
    }
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
      if (entity.type === "profile" && entity.profile?.username) {
        canonicalSlug = entity.profile.username;
      } else if (entity.type === "org" && entity.org?.slug) {
        canonicalSlug = entity.org.slug;
      }
    } else {
      published = false;
    }
  }
  const canonicalUrl = `${canonicalBaseUrl()}/${encodeURIComponent(canonicalSlug)}`;
  const ogImage = `${baseUrl()}/api/og?username=${encodeURIComponent(canonicalSlug)}`;
  const trimmedTitle = (title ?? "Linkary").trim().slice(0, 100);
  const trimmedDesc = (description ?? "Link-in-bio and credibility hub.").trim().slice(0, 160);

  return {
    title: trimmedTitle,
    description: trimmedDesc,
    alternates: { canonical: canonicalUrl },
    robots: published ? undefined : { index: false, follow: false },
    openGraph: {
      title: trimmedTitle,
      description: trimmedDesc,
      url: canonicalUrl,
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

// Revalidate: 0 so unpublish takes effect immediately (non-owners get 404); no stale published page from ISR.
export const revalidate = 0;

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
  const kind = getIdentifierKind(segment);

  if (process.env.NODE_ENV === "development" && isDebug) {
    console.log("[slug-page]", { pathname: `/${segment}`, segmentLower, reserved: isReservedPath(segmentLower), kind });
  }

  if (kind === "slug") {
    let serviceSupabase: ReturnType<typeof import("@/lib/x-analytics-server").createServiceSupabase>;
    try {
      const { createServiceSupabase } = await import("@/lib/x-analytics-server");
      serviceSupabase = createServiceSupabase();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (process.env.NODE_ENV !== "production" && isDebug) {
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
      const [byUsername, byTwitter] = await globalThis.Promise.all([
        serviceSupabase.from("profiles").select(minimalCols).ilike("username", segmentLower).maybeSingle(),
        serviceSupabase.from("profiles").select(minimalCols).ilike("twitter_username", segmentLower).maybeSingle(),
      ]);
      let minimalRow = (byUsername.data ?? byTwitter.data) as {
        id: string;
        username?: string | null;
        twitter_username?: string | null;
        published?: boolean;
      } | null;
      const matchedBy = byUsername.data ? "username" : byTwitter.data ? "twitter_username" : null;

      if (process.env.NODE_ENV === "development" && isDebug && minimalRow) {
        console.log("[slug-page] resolver=profile", { matchedBy, profile_id: minimalRow.id });
      }

      if (!minimalRow) {
        const { getPublicEntityByUsername } = await import("@/lib/publicData");
        const entityFromSlug = await getPublicEntityByUsername(segmentLower, serviceSupabase);
        if (entityFromSlug) {
          if (process.env.NODE_ENV === "development" && isDebug) {
            console.log("[slug-page] resolver=org_or_published_profile", { type: entityFromSlug.type });
          }
          const entity = await resolveEntityMediaToSignedUrls(entityFromSlug, serviceSupabase);
          const dto = entityToPublicDTO(entity);
          const entityView = dtoToEntityView(dto);
          const canonicalSlug =
            entity.type === "profile"
              ? (entity.profile?.username ?? entity.profile?.twitter_username ?? "").replace(/^@/, "").toLowerCase()
              : (entity.org?.slug ?? "").toLowerCase();
          return (
            <PublicOnePagerWrapper
              entityView={entityView}
              username={canonicalSlug || segmentLower}
              analyticsSource={dto.analytics.source}
              analyticsInitialized={dto.analytics.initialized}
              hasXConnected={entity.type === "profile" && !!entity.profile?.twitter_username}
              brochure={viewBrochure}
            />
          );
        }
        // Slug history lookup only for non-empty normalized segment (never empty string).
        // old_slug stored normalized (lower+trim); use eq to hit btree index (idx_profile_slug_history_old_slug_btree).
        const segmentNorm = segmentLower.trim().toLowerCase();
        let hist: { profile_id: string } | null = null;
        if (segmentNorm !== "") {
          const { data: historyRow } = await serviceSupabase
            .from("profile_slug_history")
            .select("profile_id")
            .eq("old_slug", segmentNorm)
            .order("changed_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          hist = historyRow as { profile_id: string } | null;
        }
        if (hist?.profile_id) {
          const { data: profileRow } = await serviceSupabase
            .from("profiles")
            .select("username")
            .eq("id", hist.profile_id)
            .maybeSingle();
          const currentUsername = (profileRow as { username?: string | null } | null)?.username?.trim();
          if (currentUsername) {
            if (process.env.NODE_ENV === "development" && isDebug) {
              console.log("[slug-page] redirect=slug_history", { from: segmentLower, to: currentUsername });
            }
            permanentRedirect(`/${encodeURIComponent(currentUsername)}`);
          }
        }
        if (isReservedPath(segmentLower)) {
          return <AppWithProviders />;
        }
        return <NotFoundClaimView requestedUsername={segmentLower} />;
      }

      const profileId = minimalRow.id;
      const isPublished = minimalRow.published === true;
      let viewer_is_owner = false;
      const { createServerSupabase } = await import("@/lib/supabase/server");
      const serverSupabase = await createServerSupabase();
      const { data: { user } } = await serverSupabase.auth.getUser();
      if (user?.id != null && user.id === profileId) viewer_is_owner = true;
      if (!isPublished && !viewer_is_owner) {
        return <NotFoundClaimView requestedUsername={segmentLower} />;
      }
      if (!isPublished && viewer_is_owner) {
        const displayUsername = (minimalRow.username ?? minimalRow.twitter_username ?? "").toString().trim().toLowerCase().replace(/^@/, "") || segmentLower;
        return <OwnerUnpublishedProfile username={displayUsername} />;
      }

      const isUnpublished = !isPublished;

      const viewCols = "id, username, twitter_username, display_name, bio, avatar_url, location, website, followers_total, avg_engagement_rate, ethos_score, xscore, rep_score, profile_type, hero_image_url, hero_video_url, hero_title, public_layout";
      const displayView = isPublished ? "public_profile_view" : "public_profile_preview_view";
      const { data: profileDisplayData } = await serviceSupabase.from(displayView).select(viewCols).eq("id", profileId).maybeSingle();
      const profileRow = profileDisplayData as {
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
        ethos_score?: number | null;
        xscore?: number | null;
        rep_score?: number | null;
        profile_type?: string | null;
        hero_image_url?: string | null;
        hero_video_url?: string | null;
        hero_title?: string | null;
        public_layout?: { preset?: string; order?: string[]; hidden?: string[]; featured_case_study_id?: string | null; featured_review_id?: string | null; featured_gig_id?: string | null } | null;
      } | null;

      if (!profileRow) {
        return <NotFoundClaimView requestedUsername={segmentLower} />;
      }

      // SEO: 301 permanent redirect alias -> canonical (if visited via twitter_username, redirect to profiles.username).
      const canonicalUsername = (profileRow.username ?? "").trim().toLowerCase();
      if (matchedBy === "twitter_username" && canonicalUsername && segmentLower !== canonicalUsername) {
        if (process.env.NODE_ENV === "development" && isDebug) {
          console.log("[slug-page] redirect=alias", { from: segmentLower, to: profileRow.username });
        }
        permanentRedirect(`/${encodeURIComponent(profileRow.username!)}`);
      }

      const profileType = (profileRow.profile_type === "project" || profileRow.profile_type === "company" ? profileRow.profile_type : "individual") as "individual" | "project" | "company";
      const heroImageUrl = profileRow.hero_image_url ?? null;
      const heroVideoUrl = profileRow.hero_video_url ?? null;
      const heroTitle = profileRow.hero_title ?? null;

      const { data: profileExtData } = await serviceSupabase.from("profiles").select("show_reviews, token_dexscreener_url, cv_document_id, meta").eq("id", profileId).maybeSingle();
      const ext = profileExtData as {
        show_reviews?: boolean | null;
        token_dexscreener_url?: string | null;
        cv_document_id?: string | null;
        meta?: { public_location?: boolean; public_pricing?: boolean; pricing?: { post?: { price_usd?: number | null; platforms?: string[]; notes?: string | null }; podcast?: { price_usd?: number | null; platforms?: string[]; notes?: string | null } } } | null;
      } | null;
      const showReviews = ext?.show_reviews !== false;
      const tokenDexscreenerUrl = (ext?.token_dexscreener_url ?? "").trim();
      const hasCv = !!ext?.cv_document_id;
      const meta = ext?.meta ?? {};
      const publicLocation = meta.public_location === true;
      const publicPricing = meta.public_pricing === true;
      const pricingMeta = meta.pricing;

      type ReviewRow = { id: string; rating: number; body: string | null; title: string | null; created_at: string; reviewer_profile_id: string | null; reviewer_type: string; verified_deal?: boolean };
      type TeamRow = { name: string; role: string | null; avatar_url: string | null; linkedin_url?: string | null; x_url?: string | null; website_url?: string | null; is_public: boolean };

      const safe = async <T,>(p: PromiseLike<{ data: T }>): Promise<T> => {
        try {
          const r = await p;
          return (r?.data ?? []) as T;
        } catch {
          return [] as unknown as T;
        }
      };
      const safeSingle = async <T,>(p: PromiseLike<{ data: T | null }>): Promise<T | null> => {
        try {
          const r = await p;
          return r?.data ?? null;
        } catch {
          return null;
        }
      };

      type CollabReviewRow = { id: string; rating: number; text: string; created_at: string; reviewer_profile_id: string };
      const promiseList: Promise<unknown>[] = [
        safeSingle(serviceSupabase.from("profile_socials").select("x_url, linkedin_url, website_url, telegram_url, youtube_url").eq("profile_id", profileId).maybeSingle()),
        showReviews ? safe(serviceSupabase.from("reviews").select("id, rating, body, title, created_at, reviewer_profile_id, reviewer_type, verified_deal").eq("reviewee_type", "profile").eq("reviewee_profile_id", profileId).eq("verified_deal", true).order("created_at", { ascending: false }).limit(10)) : globalThis.Promise.resolve([]),
        showReviews ? safe(serviceSupabase.from("collab_reviews").select("id, rating, text, created_at, reviewer_profile_id").eq("target_profile_id", profileId).order("created_at", { ascending: false }).limit(10)) : globalThis.Promise.resolve([]),
        safe(serviceSupabase.from("case_studies").select("id, title, description, proof_url, proof_file_path, metrics, created_at").eq("owner_type", "profile").eq("owner_profile_id", profileId).eq("is_public", true).order("created_at", { ascending: false }).limit(20)),
        safe(serviceSupabase.from("profile_links").select("title, url, icon").eq("profile_id", profileId).eq("is_public", true).order("sort_order", { ascending: true }).order("created_at", { ascending: true })),
        safe(serviceSupabase.from("profile_relations").select("source_profile_id, target_profile_id, relation_type, sort_order").or(`source_profile_id.eq.${profileId},target_profile_id.eq.${profileId}`).eq("is_public", true).order("relation_type").order("sort_order", { ascending: true })),
        safe(serviceSupabase.from("profile_skills").select("name, level").eq("profile_id", profileId).eq("is_public", true).order("sort_order", { ascending: true }).order("created_at", { ascending: true })),
        profileType === "individual" ? safe(serviceSupabase.from("profile_achievements").select("title, description, proof_url").eq("profile_id", profileId).eq("is_public", true).order("sort_order", { ascending: true }).order("created_at", { ascending: true })) : globalThis.Promise.resolve([]),
        profileType === "company" ? safe(serviceSupabase.from("org_team_members").select("name, role, avatar_url, linkedin_url, x_url, website_url, is_public").eq("org_profile_id", profileId).eq("is_public", true).order("sort_order", { ascending: true })) : globalThis.Promise.resolve([]),
        profileType === "project" || profileType === "company" ? safe(serviceSupabase.from("gigs").select("id, title, description, gig_type, compensation_type, budget_text, location, remote, created_at").eq("owner_profile_id", profileId).eq("is_public", true).eq("status", "open").order("created_at", { ascending: false }).limit(20)) : globalThis.Promise.resolve([]),
        safeSingle(serviceSupabase.from("profile_media").select("header_media_type, header_media_url, header_media_file_path").eq("profile_id", profileId).maybeSingle()),
        safe(serviceSupabase.from("partner_programs").select("program_type, name, website_url, logo_url, logo_file_path, description, since_date, is_featured").eq("owner_type", "profile").eq("owner_id", profileId).order("is_featured", { ascending: false }).order("sort_order", { ascending: true }).order("created_at", { ascending: true })),
        safe(serviceSupabase.from("profile_professions").select("profession_id, professions(name)").eq("profile_id", profileId)),
      ];

      const [socialsRow, reviewsList, collabReviewsList, caseStudiesList, linksList, relationsList, skillsList, achievementsList, teamList, gigsPayload, headerMediaRow, partnerProgramsList, profileProfessionsList] = await globalThis.Promise.all(promiseList) as [
        { x_url?: string | null; linkedin_url?: string | null; website_url?: string | null; telegram_url?: string | null; youtube_url?: string | null } | null,
        ReviewRow[],
        CollabReviewRow[],
        Array<{ id: string; title: string | null; description: string | null; proof_url: string | null; proof_file_path: string | null; metrics: unknown; created_at: string }>,
        Array<{ title: string; url: string; icon?: string | null }>,
        Array<{ source_profile_id: string; target_profile_id: string; relation_type: string; sort_order: number }>,
        Array<{ name: string; level: number | null }>,
        Array<{ title: string; description: string | null; proof_url: string | null }>,
        TeamRow[],
        PublicProfileApiPayload["gigs"],
        { header_media_type?: string; header_media_url?: string | null; header_media_file_path?: string | null } | null,
        Array<{ program_type?: string | null; name: string; website_url?: string | null; logo_url?: string | null; logo_file_path?: string | null; description?: string | null; is_featured?: boolean }>,
        Array<{ profession_id: string; professions: { name: string } | null }>,
      ];

      const socials = socialsRow;

      let reviewsAverage: number | null = null;
      let reviewsLatest: PublicProfileApiPayload["reviews"]["latest"] = [];
      let totalReviewsCount = 0;
      if (showReviews && (reviewsList.length > 0 || (collabReviewsList ?? []).length > 0)) {
        const legacyMapped = reviewsList.slice(0, 10).map((r) => ({ ...r, _source: "legacy" as const }));
        const collabMapped = (collabReviewsList ?? []).map((r) => ({
          id: r.id,
          rating: r.rating,
          text: r.text,
          created_at: r.created_at,
          reviewer_profile_id: r.reviewer_profile_id,
          _source: "collab" as const,
        }));
        const allReviewerIds = [
          ...new Set(legacyMapped.filter((r) => r.reviewer_type === "profile" && r.reviewer_profile_id).map((r) => r.reviewer_profile_id as string)),
          ...new Set(collabMapped.map((r) => r.reviewer_profile_id)),
        ];
        let reviewerByProfileId: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
        if (allReviewerIds.length > 0) {
          const { data: profiles } = await serviceSupabase.from("public_profile_view").select("id, display_name, avatar_url").in("id", allReviewerIds);
          if (profiles) {
            for (const p of profiles as Array<{ id: string; display_name: string | null; avatar_url: string | null }>) {
              reviewerByProfileId[p.id] = { display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null };
            }
          }
        }
        const legacyItems: PublicProfileApiPayload["reviews"]["latest"] = legacyMapped.map((r) => {
          const reviewer = r.reviewer_type === "profile" && r.reviewer_profile_id ? reviewerByProfileId[r.reviewer_profile_id] : null;
          return {
            id: r.id,
            rating: r.rating,
            title: r.title ?? null,
            text: r.body ?? null,
            created_at: r.created_at,
            reviewer_display: reviewer?.display_name ?? "Anonymous",
            reviewer_avatar_url: reviewer?.avatar_url ?? null,
            verified_deal: false,
            source: "legacy" as const,
          };
        });
        const collabItems: PublicProfileApiPayload["reviews"]["latest"] = collabMapped.map((r) => {
          const reviewer = reviewerByProfileId[r.reviewer_profile_id];
          return {
            id: r.id,
            rating: r.rating,
            title: null,
            text: r.text,
            created_at: r.created_at,
            reviewer_display: reviewer?.display_name ?? "Anonymous",
            reviewer_avatar_url: reviewer?.avatar_url ?? null,
            verified_deal: true,
            source: "collab" as const,
          };
        });
        const combined = [...legacyItems, ...collabItems].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
        reviewsLatest = combined;
        reviewsAverage = combined.length > 0 ? combined.reduce((s, r) => s + r.rating, 0) / combined.length : null;
        totalReviewsCount = legacyItems.length + collabItems.length;
      }

      let reputationIndex: number;
      try {
        reputationIndex = await computeReputationIndex(profileId, serviceSupabase, {
          debug: process.env.NODE_ENV !== "production" && isDebug,
        });
      } catch {
        reputationIndex = 0;
      }

      const { createSignedUrlForPath } = await import("@/lib/mediaSignedUrlServer");
      const caseStudies = await Promise.all(
        caseStudiesList.map(async (c) => {
          let imageUrl: string | null = null;
          const path = (c as { proof_file_path?: string | null }).proof_file_path?.trim();
          if (path && !path.includes("..")) {
            const signed = await createSignedUrlForPath(serviceSupabase, path);
            imageUrl = signed ?? null;
          }
          return {
            id: c.id,
            title: c.title ?? null,
            summary: c.description ?? null,
            tags: tagsFromMetrics(c.metrics),
            url: c.proof_url ?? null,
            imageUrl,
          };
        })
      );

      const skills = skillsList.map((s) => ({ name: s.name, level: s.level }));
      const achievements = achievementsList.map((a) => ({ title: a.title, description: a.description ?? null, url: a.proof_url ?? null }));

      let resolvedHeroImageUrl: string | null = heroImageUrl;
      if (heroImageUrl && typeof heroImageUrl === "string" && heroImageUrl.startsWith("profile/")) {
        const { createSignedUrlForPath } = await import("@/lib/mediaSignedUrlServer");
        resolvedHeroImageUrl = await createSignedUrlForPath(serviceSupabase, heroImageUrl) ?? heroImageUrl;
      }

      let headerMediaPayload: PublicProfileApiPayload["header_media"] = null;
      if (headerMediaRow && (headerMediaRow.header_media_type === "IMAGE" || headerMediaRow.header_media_type === "VIDEO")) {
        const path = headerMediaRow.header_media_file_path?.trim();
        const legacyUrl = headerMediaRow.header_media_url?.trim();
        if (path && !path.includes("..")) {
          const { createSignedUrlForPath } = await import("@/lib/mediaSignedUrlServer");
          const signed = await createSignedUrlForPath(serviceSupabase, path);
          if (signed) headerMediaPayload = { type: headerMediaRow.header_media_type as "IMAGE" | "VIDEO", url: signed };
        } else if (legacyUrl && (legacyUrl.startsWith("https://") || legacyUrl.startsWith("//"))) {
          headerMediaPayload = { type: headerMediaRow.header_media_type as "IMAGE" | "VIDEO", url: legacyUrl.startsWith("//") ? `https:${legacyUrl}` : legacyUrl };
        }
      }

      const rolesList: string[] = (profileProfessionsList ?? []).map((r) => (r.professions?.name ?? "")).filter(Boolean);

      let completedCollabsPayload: PublicProfileApiPayload["completed_collabs"] = { total: 0, counterparties: [] };
      try {
        const { data: doneRows } = await serviceSupabase
          .from("collab_requests")
          .select("requester_profile_id, target_profile_id, created_at")
          .eq("status", "done")
          .or(`requester_profile_id.eq.${profileId},target_profile_id.eq.${profileId}`)
          .order("created_at", { ascending: false })
          .limit(50);
        const rows = (doneRows ?? []) as Array<{ requester_profile_id: string; target_profile_id: string; created_at: string }>;
        const counterpartyIds = [...new Set(rows.map((r) => (r.requester_profile_id === profileId ? r.target_profile_id : r.requester_profile_id)))];
        if (counterpartyIds.length > 0) {
          const { data: publicProfs } = await serviceSupabase
            .from("public_profile_view")
            .select("id, username, display_name, avatar_url")
            .in("id", counterpartyIds);
          const list = (publicProfs ?? []) as Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null }>;
          const byId: Record<string, { id: string; username: string; display_name: string | null; avatar_url: string | null }> = {};
          for (const p of list) {
            const username = (p.username ?? "").trim();
            if (username) byId[p.id] = { id: p.id, username, display_name: p.display_name ?? null, avatar_url: p.avatar_url ?? null };
          }
          const ordered = rows.map((r) => (r.requester_profile_id === profileId ? r.target_profile_id : r.requester_profile_id));
          const seen = new Set<string>();
          const last5: Array<{ id: string; username: string; display_name: string | null; avatar_url: string | null }> = [];
          for (const id of ordered) {
            if (seen.has(id)) continue;
            seen.add(id);
            const cp = byId[id];
            if (cp) {
              last5.push(cp);
              if (last5.length >= 5) break;
            }
          }
          completedCollabsPayload = { total: rows.length, counterparties: last5 };
        }
      } catch {
        /* non-fatal */
      }

      const partnerProgramsPayload: NonNullable<PublicProfileApiPayload["partner_programs"]> = (partnerProgramsList ?? []).map((pp) => ({
        name: pp.name,
        program_type: pp.program_type ?? null,
        website_url: pp.website_url ?? null,
        logo_url: pp.logo_url ?? null,
        description: pp.description ?? null,
        is_featured: pp.is_featured ?? false,
      }));

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

      const layoutObj = profileRow.public_layout && typeof profileRow.public_layout === "object" ? profileRow.public_layout : {};
      const rawPreset = typeof (layoutObj as { preset?: string }).preset === "string" ? (layoutObj as { preset: string }).preset : "classic";
      const layoutPreset: "classic" | "spotlight" | "showcase" | "compact" =
        rawPreset === "spotlight" || rawPreset === "showcase" || rawPreset === "compact" ? rawPreset : "classic";
      const layoutOrder = Array.isArray((layoutObj as { order?: string[] }).order) ? (layoutObj as { order: string[] }).order : null;
      const layoutHidden = Array.isArray((layoutObj as { hidden?: string[] }).hidden) ? (layoutObj as { hidden: string[] }).hidden : null;
      const featuredCaseStudyId = (layoutObj as { featured_case_study_id?: string | null }).featured_case_study_id ?? null;
      const featuredReviewId = (layoutObj as { featured_review_id?: string | null }).featured_review_id ?? null;
      const featuredGigId = (layoutObj as { featured_gig_id?: string | null }).featured_gig_id ?? null;
      const displayUsernameForPayload = profileRow.username ?? profileRow.twitter_username ?? segmentLower;
      const locationForPayload = publicLocation && profileRow.location?.trim() ? profileRow.location.trim() : null;
      const pricingPayload: PublicProfileApiPayload["pricing"] =
        publicPricing && pricingMeta
          ? (() => {
              const post = pricingMeta.post;
              const podcast = pricingMeta.podcast;
              const postUsd = typeof post?.price_usd === "number" && post.price_usd >= 0 ? post.price_usd : null;
              const podcastUsd = typeof podcast?.price_usd === "number" && podcast.price_usd >= 0 ? podcast.price_usd : null;
              if (postUsd == null && podcastUsd == null) return null;
              return {
                ...(postUsd != null ? { post: { price_usd: postUsd, platforms: Array.isArray(post?.platforms) ? post.platforms : [], notes: post?.notes ?? null } } : {}),
                ...(podcastUsd != null ? { podcast: { price_usd: podcastUsd, platforms: Array.isArray(podcast?.platforms) ? podcast.platforms : [], notes: podcast?.notes ?? null } } : {}),
              } as PublicProfileApiPayload["pricing"];
            })()
          : null;

      const payload: PublicProfileApiPayload = {
        profile: {
          username: profileRow.username ?? profileRow.twitter_username ?? null,
          display_name: profileRow.display_name ?? null,
          bio: profileRow.bio ?? null,
          avatar_url: profileRow.avatar_url ?? null,
          location: locationForPayload,
          roles: rolesList,
          is_verified: false,
          ethos_score: profileRow.ethos_score ?? null,
          xscore: profileRow.xscore ?? null,
          reputation_index: reputationIndex,
          rep_score: profileRow.rep_score != null && Number.isInteger(Number(profileRow.rep_score)) ? Number(profileRow.rep_score) : null,
          profile_type: profileType,
          public_layout: layoutPreset,
          layout_order: layoutOrder,
          layout_hidden: layoutHidden,
          featured_case_study_id: featuredCaseStudyId,
          featured_review_id: featuredReviewId,
          featured_gig_id: featuredGigId,
        },
        hero:
          resolvedHeroImageUrl || heroVideoUrl || heroTitle
            ? {
                hero_image_url: resolvedHeroImageUrl,
                hero_video_url: heroVideoUrl,
                hero_title: heroTitle,
              }
            : null,
        ...(headerMediaPayload ? { header_media: headerMediaPayload } : {}),
        ...(hasCv ? { cv: { download_url: `/api/public/cv/${encodeURIComponent(displayUsernameForPayload)}` } } : {}),
        ...(partnerProgramsPayload.length > 0 ? { partner_programs: partnerProgramsPayload } : {}),
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
          youtube: socials?.youtube_url ?? null,
        },
        links: linksList.map((l) => ({
          title: l.title,
          url: l.url,
          icon: l.icon ?? undefined,
        })),
        caseStudies,
        reviews: {
          average: reviewsAverage,
          count: totalReviewsCount,
          latest: reviewsLatest,
        },
        show_reviews: showReviews,
        ...(completedCollabsPayload.total > 0 ? { completed_collabs: completedCollabsPayload } : {}),
        token: tokenPayload,
        ...(Object.keys(relationsPayload).length > 0 ? { relations: relationsPayload } : {}),
        ...((gigsPayload ?? []).length > 0 ? { gigs: gigsPayload ?? [] } : {}),
        ...(skills.length > 0 ? { skills } : {}),
        ...(achievements.length > 0 ? { achievements } : {}),
        ...(pricingPayload ? { pricing: pricingPayload } : {}),
      };

      payload.viewer_is_owner = viewer_is_owner;

      const displayUsername = payload.profile.username ?? segmentLower;

      const profileUrl = `${canonicalBaseUrl()}/${encodeURIComponent(displayUsername)}`;
      return (
        <div className="min-h-screen bg-background text-foreground font-sans">
          {isUnpublished && (
            <div className="bg-muted/80 border-b border-border px-4 py-2.5 text-center text-sm text-muted-foreground">
              This profile is not published yet.
            </div>
          )}
          <PublicProfileContent data={payload} username={displayUsername} profileUrl={profileUrl} />
          {process.env.NODE_ENV !== "production" && isDebug && (
            <pre className="mx-auto max-w-xl px-4 py-6 text-xs text-muted-foreground overflow-auto rounded bg-muted p-4 mt-4">
              {JSON.stringify(
                {
                  requestedUsername: segment,
                  normalizedUsername: segmentLower,
                  matchedBy,
                  profile_id: profileId,
                  counts: { reviewsCount: totalReviewsCount, caseStudiesCount: caseStudiesList.length },
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
      if (process.env.NODE_ENV !== "production" && isDebug) {
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
