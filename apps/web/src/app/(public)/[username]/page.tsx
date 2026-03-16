import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getIdentifierKind, normalizeIdentifier, resolvePublicEntity } from "@/lib/entityResolver";
import { isReservedPath } from "@/lib/reservedPaths";
import { dtoToEntityView, entityToPublicDTO } from "@/lib/publicProfileDTO";
import { resolveEntityMediaToSignedUrls } from "@/lib/resolveEntityMediaUrls";
import { buildPublicProfilePayloadFromEntity } from "@/lib/buildPublicProfilePayload";
import AppWithProviders from "../../AppWithProviders";
import { PublicOnePagerWrapper } from "./PublicOnePagerWrapper";
import { PublicProfileContent } from "./PublicProfileContent";
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
      if (process.env.E2E_FIXTURE_USERNAME && segmentLower === process.env.E2E_FIXTURE_USERNAME) {
        const { e2eProofFixture } = await import("@/lib/e2ePublicProfileFixture");
        const canonicalBase = canonicalBaseUrl();
        return (
          <PublicProfileContent
            data={e2eProofFixture}
            username={e2eProofFixture.profile?.username ?? segmentLower}
            profileUrl={`${canonicalBase}/${encodeURIComponent(segmentLower)}`}
          />
        );
      }
      const { getPublicEntityByUsername, getUsernameOwner } = await import("@/lib/publicData");
      const entityFromSlug = await getPublicEntityByUsername(segmentLower, serviceSupabase);
      if (entityFromSlug) {
        if (process.env.NODE_ENV === "development" && isDebug) {
          console.log("[slug-page] resolver=usernames", { type: entityFromSlug.type });
        }
        const entity = await resolveEntityMediaToSignedUrls(entityFromSlug, serviceSupabase);
        const dto = entityToPublicDTO(entity);
        const entityView = dtoToEntityView(dto);
        const canonicalSlug =
          entity.type === "profile"
            ? (entity.profile?.username ?? entity.profile?.twitter_username ?? "").replace(/^@/, "").toLowerCase()
            : (entity.org?.slug ?? "").toLowerCase();

        if (!viewBrochure) {
          const data = await buildPublicProfilePayloadFromEntity(entity, serviceSupabase);
          return (
            <PublicProfileContent
              data={data}
              username={data.profile?.username ?? data.profile?.display_name ?? canonicalSlug ?? segmentLower}
              profileUrl={`${canonicalBaseUrl()}/${encodeURIComponent(canonicalSlug || segmentLower)}`}
            />
          );
        }
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

      const owner = await getUsernameOwner(segmentLower, serviceSupabase);
      if (owner?.owner_type === "profile") {
        const { createServerSupabase } = await import("@/lib/supabase/server");
        const serverSupabase = await createServerSupabase();
        const { data: { user } } = await serverSupabase.auth.getUser();
        if (user?.id && owner.owner_id === user.id) {
          const { data: profileRow } = await serviceSupabase
            .from("profiles")
            .select("id, username, twitter_username, published")
            .eq("id", owner.owner_id)
            .maybeSingle();
          if (profileRow && profileRow.published !== true) {
            const displayUsername = (profileRow.username ?? profileRow.twitter_username ?? "").toString().trim().toLowerCase().replace(/^@/, "") || segmentLower;
            return <OwnerUnpublishedProfile username={displayUsername} />;
          }
        }
      }

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

  if (!viewBrochure) {
    try {
      const base = baseUrl();
      const res = await fetch(`${base}/api/public/profile?username=${encodeURIComponent(canonicalUsername || segmentLower)}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        return (
          <PublicProfileContent
            data={data}
            username={data.profile?.username ?? data.profile?.display_name ?? canonicalUsername ?? segmentLower}
            profileUrl={`${canonicalBaseUrl()}/${encodeURIComponent(canonicalUsername || segmentLower)}`}
          />
        );
      }
    } catch {
      /* fallback to one-pager */
    }
  }
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