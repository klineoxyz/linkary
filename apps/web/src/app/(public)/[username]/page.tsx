import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getIdentifierKind, normalizeIdentifier, resolvePublicEntity } from "@/lib/entityResolver";
import { isReservedPath } from "@/lib/reservedPaths";
import { getPublicDTOByUsername } from "@/lib/getPublicDTO";
import { dtoToEntityView, entityToPublicDTO } from "@/lib/publicProfileDTO";
import AppWithProviders from "../../AppWithProviders";
import { PublicOnePagerWrapper } from "./PublicOnePagerWrapper";
import { NotFoundOrUnpublished } from "./NotFoundOrUnpublished";
import { NotFoundClaimView } from "./NotFoundClaimView";

type Props = { params: Promise<{ username: string }>; searchParams?: Promise<{ view?: string }> };

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://linkary.xyz");
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
  if (kind === "wallet") {
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
  if (kind === "slug") {
    const result = await getPublicDTOByUsername(segment, { serviceSupabase: serviceSupabase ?? undefined });
    published = result.ok;
    if (result.ok) {
      const d = result.dto;
      const name = d.type === "profile" ? (d.display_name || d.username || d.twitter_username || segment) : d.name;
      title = `${name} on Linkary`;
      const bio = d.type === "profile" ? d.bio : d.tagline;
      if (bio && typeof bio === "string") {
        description = bio.length > 160 ? bio.slice(0, 157) + "…" : bio;
      }
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

/**
 * Public URL: /[identifier] — slug, UUID, X handle, or wallet.
 * Uses single source (DTO) for public data; never sends profile/id or org id to client.
 */
export default async function PublicUsernamePage({ params, searchParams }: Props) {
  const { username } = await params;
  const resolvedSearch = searchParams ? await searchParams : {};
  const viewBrochure = resolvedSearch?.view === "brochure";
  const segment = (username ?? "").trim();
  if (!segment) notFound();

  const segmentLower = normalizeIdentifier(segment);
  if (isReservedPath(segmentLower)) {
    return <AppWithProviders />;
  }

  const kind = getIdentifierKind(segment);
  let serviceSupabase: import("@supabase/supabase-js").SupabaseClient | null = null;
  if (kind === "wallet") {
    try {
      const { createServiceSupabase } = await import("@/lib/x-analytics-server");
      serviceSupabase = createServiceSupabase();
    } catch {
      /* no service key; wallet resolution skipped */
    }
  }

  if (kind === "slug") {
    const result = await getPublicDTOByUsername(segment, {
      serviceSupabase: serviceSupabase ?? undefined,
    });

    if (result.ok) {
      const entityView = dtoToEntityView(result.dto);
      return (
        <PublicOnePagerWrapper
          entityView={entityView}
          username={result.canonicalUsername}
          analyticsSource={result.dto.analytics.source}
          analyticsInitialized={result.dto.analytics.initialized}
          hasXConnected={result.dto.type === "profile" && !!result.dto.twitter_username}
          brochure={viewBrochure}
        />
      );
    }

    return <NotFoundOrUnpublished requestedUsername={segmentLower} />;
  }

  const entity = await resolvePublicEntity(segment, { serviceSupabase: serviceSupabase ?? undefined });
  if (!entity) {
    if (kind === "wallet") notFound();
    return <NotFoundClaimView requestedUsername={segmentLower} />;
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
