import type { PublicProfileApiPayload } from "@/app/api/public/profile/route";
import {
  LEFT_COLUMN_KEYS,
  PRESET_DEFAULT_ORDER,
  PRESET_DEFAULT_HIDDEN,
  RIGHT_COLUMN_KEYS,
  SECTION_KEYS,
  type PresetName,
  type SectionKey,
} from "@/lib/publicLayoutPresets";
import { BadgeCheck, ChevronRight, ExternalLink, Globe, Link2, Share2 } from "lucide-react";
import Link from "next/link";
import React, { Fragment } from "react";
import { CopyProfileLinkButton } from "./CopyProfileLinkButton";
import { ApplyToGigButton } from "./ApplyToGigButton";
import { TrustStrip } from "@/components/TrustStrip";
import { EcosystemModule } from "./EcosystemModule";
import { ActionBar } from "./ActionBar";
import { StarterBlock } from "./StarterBlock";

/** Derive 2–4 highlight bullets from case study (no DB). Use summary sentences or tag-based. */
function proofHighlights(
  summary: string | null,
  tags: string[]
): string[] {
  const bullets: string[] = [];
  if (summary?.trim()) {
    const sentences = summary
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 3);
    bullets.push(...sentences);
  }
  if (bullets.length < 3 && tags.length > 0) {
    const need = Math.min(3 - bullets.length, tags.length, 2);
    for (let i = 0; i < need; i++) {
      bullets.push(`Worked on: ${tags[i]}`);
    }
  }
  return bullets.slice(0, 4);
}

/** Extract hostname from URL for display; safe for any string. */
function getHostname(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Shared card style for sections: Linkary card with subtle glow on hover. */
const sectionCardClass =
  "rounded-2xl border border-border bg-card/95 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md hover:shadow-primary/10";

type RelationCard = { id: string; username: string; display_name: string | null; avatar_url: string | null; profile_type: string };

function RelationCardLink({ item, basePath }: { item: RelationCard; basePath: string }) {
  const href = `${basePath}/${encodeURIComponent(item.username)}`;
  const name = item.display_name || item.username;
  const typeLabel = item.profile_type === "company" ? "Company" : item.profile_type === "project" ? "Project" : "Individual";
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground transition-all hover:border-primary/30 hover:bg-accent/50 hover:shadow-sm ${sectionCardClass}`}
    >
      {item.avatar_url ? (
        <img src={item.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover border border-border" />
      ) : (
        <div className="h-8 w-8 shrink-0 rounded-full bg-muted border border-border" />
      )}
      <span className="font-medium truncate min-w-0">{name}</span>
      <span className="shrink-0 rounded-lg border border-border bg-primary/5 px-2 py-0.5 text-xs font-medium text-foreground">{typeLabel}</span>
    </Link>
  );
}

const socialIconSize = 20;

function IconX() {
  return (
    <svg width={socialIconSize} height={socialIconSize} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function IconLinkedIn() {
  return (
    <svg width={socialIconSize} height={socialIconSize} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function IconTelegram() {
  return (
    <svg width={socialIconSize} height={socialIconSize} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function IconYouTube() {
  return (
    <svg width={socialIconSize} height={socialIconSize} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function IconDiscord() {
  return (
    <svg width={socialIconSize} height={socialIconSize} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function SocialLink({ name, url }: { name: string; url: string }) {
  const icon =
    name === "X" ? (
      <IconX />
    ) : name === "LinkedIn" ? (
      <IconLinkedIn />
    ) : name === "Telegram" ? (
      <IconTelegram />
    ) : name === "YouTube" ? (
      <IconYouTube />
    ) : name === "Discord" ? (
      <IconDiscord />
    ) : (
      <Globe className="size-5 shrink-0" aria-hidden />
    );
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all hover:border-primary/40 hover:bg-accent hover:text-primary hover:shadow-md hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      aria-label={`${name} profile or link`}
    >
      {icon}
    </a>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2.5 text-sm font-semibold tracking-tight text-foreground">
      <span className="h-px w-6 shrink-0 rounded-full bg-primary" aria-hidden />
      {children}
    </h2>
  );
}

/** Star rating display (1–5). Filled stars by rating, empty for rest. */
function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  const n = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className={`inline-flex items-center gap-0.5 text-amber-500 ${className}`} aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="text-lg leading-none" aria-hidden>
          {i <= n ? "★" : "☆"}
        </span>
      ))}
    </span>
  );
}

function isYouTubeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "www.youtube.com" || u.hostname === "youtube.com" || u.hostname === "youtu.be";
  } catch {
    return false;
  }
}

function youtubeEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      return `https://www.youtube.com/embed/${id}`;
    }
    const v = u.searchParams.get("v");
    if (v) return `https://www.youtube.com/embed/${v}`;
  } catch {
    /* ignore */
  }
  return url;
}

function isVimeoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "vimeo.com" || u.hostname === "www.vimeo.com" || u.hostname === "player.vimeo.com";
  } catch {
    return false;
  }
}

function vimeoEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    let id = "";
    if (u.hostname === "player.vimeo.com" && u.pathname.startsWith("/video/")) {
      id = u.pathname.replace("/video/", "").split("/")[0];
    } else if (u.pathname && u.pathname !== "/") {
      id = u.pathname.slice(1).split("/")[0];
    }
    if (id) return `https://player.vimeo.com/video/${id}`;
  } catch {
    /* ignore */
  }
  return url;
}

function isLoomUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "www.loom.com" || u.hostname === "loom.com" || u.hostname === "share.loom.com";
  } catch {
    return false;
  }
}

function loomEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    const embedMatch = u.pathname.match(/\/embed\/([^/]+)/);
    if (embedMatch) return url;
    const shareMatch = u.pathname.match(/\/share\/([^/]+)/);
    if (shareMatch) return `https://www.loom.com/embed/${shareMatch[1]}`;
    const firstSegment = u.pathname.slice(1).split("/")[0];
    if (firstSegment) return `https://www.loom.com/embed/${firstSegment}`;
  } catch {
    /* ignore */
  }
  return url;
}

function isXVideoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "twitter.com" || u.hostname === "www.twitter.com" || u.hostname === "x.com" || u.hostname === "www.x.com";
  } catch {
    return false;
  }
}

type Props = {
  data: PublicProfileApiPayload;
  username: string;
  profileUrl?: string;
  isAuthenticated?: boolean;
};

export function PublicProfileContent({ data, username, profileUrl: profileUrlProp, isAuthenticated = false }: Props) {
  const { profile, hero, team = [], socials, links, caseStudies, reviews, show_reviews: showReviews = true, token, relations, skills = [], achievements = [] } = data;
  const profileType = profile.profile_type ?? "individual";
  const displayName = profile.display_name ?? profile.username ?? username;
  const handle = profile.username ?? username;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://linkary.xyz";
  const basePath = base.replace(/\/$/, "");
  const profileUrl = profileUrlProp ?? `${basePath}/${encodeURIComponent(handle)}`;

  const layoutPreset: PresetName = (profile.public_layout === "spotlight" || profile.public_layout === "showcase" || profile.public_layout === "compact")
    ? profile.public_layout
    : "classic";
  const isSpotlight = layoutPreset === "spotlight";
  const isShowcase = layoutPreset === "showcase";
  const isCompact = layoutPreset === "compact";
  const sectionSpacing = isCompact ? "mb-5" : "mb-8";
  const rightSectionSpacing = isCompact ? "mb-5" : "mb-8";
  const featuredCardClass = isShowcase ? "rounded-2xl border-2 border-primary/25 bg-card shadow-lg hover:shadow-primary/15 hover:border-primary/35" : sectionCardClass;

  const hasCustomOrder = Array.isArray(profile.layout_order) && profile.layout_order.length > 0;
  const resolvedOrder: SectionKey[] = hasCustomOrder
    ? profile.layout_order!.filter((k): k is SectionKey => SECTION_KEYS.includes(k as SectionKey))
    : PRESET_DEFAULT_ORDER[layoutPreset];
  const hasCustomHidden = Array.isArray(profile.layout_hidden);
  const resolvedHidden: SectionKey[] = hasCustomHidden
    ? profile.layout_hidden!.filter((k): k is SectionKey => SECTION_KEYS.includes(k as SectionKey))
    : PRESET_DEFAULT_HIDDEN[layoutPreset];
  const hiddenSet = new Set(resolvedHidden);
  const visibleOrder = resolvedOrder.filter((k) => !hiddenSet.has(k));

  const featuredCaseStudyId = profile.featured_case_study_id ?? null;
  const featuredReviewId = profile.featured_review_id ?? null;
  const featuredGigId = profile.featured_gig_id ?? null;
  const featuredCaseStudy =
    featuredCaseStudyId
      ? caseStudies.find((c) => c.id === featuredCaseStudyId) ?? null
      : (() => {
          if (!caseStudies.length) return null;
          const withUrlAndSummary = caseStudies.filter((c) => (c.url?.trim() && c.summary?.trim()) || c.summary?.trim());
          const pool = withUrlAndSummary.length > 0 ? withUrlAndSummary : caseStudies;
          return pool[0] ?? null;
        })();
  const featuredReview =
    featuredReviewId && reviews.latest?.length
      ? reviews.latest.find((r) => (r as { id?: string }).id === featuredReviewId) ?? null
      : (() => {
          if (!reviews.latest?.length) return null;
          const sorted = [...reviews.latest].sort((a, b) => {
            if (b.rating !== a.rating) return b.rating - a.rating;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
          return sorted[0] ?? null;
        })();
  const featuredGig =
    featuredGigId && data.gigs?.length
      ? data.gigs.find((g) => g.id === featuredGigId) ?? null
      : (() => {
          if (!data.gigs?.length || (profileType !== "project" && profileType !== "company")) return null;
          const byNewest = [...data.gigs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          return byNewest[0] ?? null;
        })();
  const showFeatured = !isCompact && (!!featuredCaseStudy || !!featuredReview || !!featuredGig);

  const socialLinks: { name: string; url: string }[] = [
    { name: "X", url: socials.x ?? null },
    { name: "Telegram", url: socials.telegram ?? null },
    { name: "Discord", url: socials.discord ?? null },
    { name: "LinkedIn", url: socials.linkedin ?? null },
    { name: "Website", url: socials.website ?? null },
    { name: "YouTube", url: socials.youtube ?? null },
  ].filter((l): l is { name: string; url: string } => !!l.url && l.url.trim() !== "");

  const hasHeroImage = !!(hero?.hero_image_url?.trim());
  const hasHeroVideo = !!(hero?.hero_video_url?.trim()) && !hasHeroImage;
  const heroTitle = hero?.hero_title?.trim() || null;

  const hasProofStats =
    profile.ethos_score != null || profile.xscore != null || profile.reputation_index != null;

  const hasHero = hasHeroImage || hasHeroVideo || !!heroTitle;
  const hasAnyRelation =
    relations &&
    ((relations.ambassadors?.length ?? 0) > 0 ||
      (relations.affiliates?.length ?? 0) > 0 ||
      (relations.ecosystemProjects?.length ?? 0) > 0 ||
      (relations.subsidiaries?.length ?? 0) > 0 ||
      (relations.ambassadorOf?.length ?? 0) > 0 ||
      (relations.affiliateOf?.length ?? 0) > 0);
  const isLowContent =
    !hasHero &&
    caseStudies.length === 0 &&
    (reviews?.count ?? 0) === 0 &&
    (profileType === "individual" || ((data.gigs?.length ?? 0) === 0 && !hasAnyRelation));

  const hasCaseStudy = caseStudies.length >= 1;
  const hasGig = (profileType === "project" || profileType === "company") && (data.gigs?.length ?? 0) >= 1;
  const hasReview = (reviews?.count ?? 0) >= 1;
  const hasRelationForOrg = (profileType === "project" || profileType === "company") && !!hasAnyRelation;
  const completenessScore = Math.min(
    100,
    (hasHero ? 20 : 0) +
      (hasCaseStudy ? 25 : 0) +
      (hasGig ? 25 : 0) +
      (hasRelationForOrg ? 15 : 0) +
      (hasReview ? 15 : 0)
  );
  const nextCompletenessAction: { label: string; href: string } | null = !hasHero
    ? { label: "Add a hero image or title", href: "/profile/edit#basics" }
    : !hasCaseStudy
      ? { label: "Add a proof card (case study)", href: "/profile/edit#case-studies" }
      : (profileType === "project" || profileType === "company") && !hasGig
        ? { label: "Post an open gig", href: "/profile/edit#gigs" }
        : (profileType === "project" || profileType === "company") && !hasAnyRelation
          ? { label: "Add ecosystem partners", href: "/profile/edit" }
          : !hasReview
            ? { label: "Get verified reviews", href: "/profile/edit" }
            : null;

  const leftOrder = visibleOrder.filter((k) => LEFT_COLUMN_KEYS.includes(k));
  const rightOrder = visibleOrder.filter((k) => RIGHT_COLUMN_KEYS.includes(k));

  const renderSection = (key: SectionKey): React.ReactNode => {
    switch (key) {
      case "header":
        return (
          <header className="pb-6 border-b border-border">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-24 w-24 shrink-0 rounded-2xl object-cover border-2 border-border shadow-md ring-2 ring-transparent" />
              ) : (
                <div className="h-24 w-24 shrink-0 rounded-2xl bg-muted border-2 border-border" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{displayName}</h1>
                  {profile.is_verified && <BadgeCheck className="h-5 w-5 shrink-0 text-primary" aria-label="Verified" />}
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary" aria-label="Profile type">
                    {profileType === "company" ? "Company" : profileType === "project" ? "Project" : "Individual"}
                  </span>
                  {profile.reputation_index != null && (
                    <span className="rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-bold tabular-nums text-primary shadow-sm shadow-primary/15">{profile.reputation_index} rep</span>
                  )}
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">@{handle}</p>
              </div>
            </div>
            {profile.location && <p className="mt-3 text-sm text-muted-foreground">{profile.location}</p>}
            {profile.bio && <p className="mt-3 text-sm text-foreground leading-relaxed">{profile.bio}</p>}
            <div className="mt-4"><CopyProfileLinkButton url={profileUrl} /></div>
          </header>
        );
      case "socials":
        if (socialLinks.length === 0) return null;
        return (
          <div className={`flex flex-wrap gap-2 ${sectionSpacing}`}>
            {socialLinks.map((l) => <SocialLink key={l.name} name={l.name} url={l.url} />)}
          </div>
        );
      case "trust_strip": {
        const score = profile.reputation_index ?? null;
        return (
          <div className={sectionSpacing}>
            <TrustStrip
              score={score}
              tierLabel={null}
              reviewsAvg={reviews.average ?? null}
              reviewsCount={reviews.count ?? 0}
              xHandle={socials.x?.trim() ? "X" : null}
              variant="public"
            />
          </div>
        );
      }
      case "action_bar":
        return (
          <div className={rightSectionSpacing}>
            <ActionBar
              profileType={profileType}
              username={handle}
              profileUrl={profileUrl}
              isAuthenticated={isAuthenticated}
              canApplyToGigs={isAuthenticated}
            />
          </div>
        );
      case "starter_block":
        if (!isLowContent) return null;
        return (
          <div className={rightSectionSpacing}>
            <StarterBlock
              username={handle}
              profileType={profileType}
              profileUrl={profileUrl}
              isLowContent={isLowContent}
              completenessScore={completenessScore}
              nextAction={nextCompletenessAction}
            />
          </div>
        );
      case "proof":
        if (!hasProofStats) return null;
        return (
          <section className={sectionSpacing}>
            <SectionTitle>Proof</SectionTitle>
            <div className={`${sectionCardClass} border-primary/20 p-5`}>
              <div className="flex flex-wrap gap-6">
                {profile.reputation_index != null && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Linkary reputation</p>
                    <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{profile.reputation_index}</p>
                  </div>
                )}
                {profile.xscore != null && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">XScore</p>
                    <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{profile.xscore}</p>
                  </div>
                )}
                {profile.ethos_score != null && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ethos score</p>
                    <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{profile.ethos_score}</p>
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      case "featured":
        if (!showFeatured) return null;
        return (
          <section className={rightSectionSpacing}>
            <SectionTitle>Featured</SectionTitle>
            <div className="space-y-4">
              {profileType !== "individual" && featuredGig && (
                <div className={`${featuredCardClass} p-5`}>
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary">Featured gig</span>
                  <h3 className="mt-1 text-lg font-semibold text-foreground">{featuredGig.title}</h3>
                  {featuredGig.description && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{featuredGig.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium capitalize text-foreground">{featuredGig.gig_type}</span>
                    {featuredGig.budget_text && <span className="text-sm font-medium text-primary">{featuredGig.budget_text}</span>}
                  </div>
                  <div className="mt-4"><ApplyToGigButton gig={featuredGig} ownerUsername={handle} basePath={basePath} /></div>
                </div>
              )}
              {featuredCaseStudy && (
                <div className={`${featuredCardClass} p-5`}>
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary">Featured case study</span>
                  {featuredCaseStudy.title && <h3 className="mt-1 text-lg font-semibold text-foreground">{featuredCaseStudy.title}</h3>}
                  {featuredCaseStudy.summary && <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{featuredCaseStudy.summary}</p>}
                  {featuredCaseStudy.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {featuredCaseStudy.tags.map((t) => <span key={t} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">{t}</span>)}
                    </div>
                  )}
                  {featuredCaseStudy.url && (
                    <a href={featuredCaseStudy.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">View proof <ExternalLink className="h-3.5 w-3.5" /></a>
                  )}
                </div>
              )}
              {featuredReview && (
                <div className={`${featuredCardClass} p-5`}>
                  <span className="text-xs font-semibold uppercase tracking-wide text-primary">Featured review</span>
                  <div className="mt-3 flex gap-3">
                    {featuredReview.reviewer_avatar_url ? <img src={featuredReview.reviewer_avatar_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover border border-border ring-2 ring-primary/20" /> : <div className="h-11 w-11 shrink-0 rounded-full border border-border bg-muted" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{featuredReview.reviewer_display ?? "Anonymous"}</span>
                        <Stars rating={featuredReview.rating} className="shrink-0" />
                        {featuredReview.verified_deal !== false && <span className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary shrink-0">Verified deal</span>}
                      </div>
                      {featuredReview.title && <p className="mt-1 text-sm font-medium text-foreground">{featuredReview.title}</p>}
                      {featuredReview.text && <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">{featuredReview.text}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        );
      case "token":
        if (profileType !== "project" || !token) return null;
        return (
          <section className={rightSectionSpacing}>
            <SectionTitle>Token</SectionTitle>
            <div className={`${sectionCardClass} p-5`}>
              <div className="flex flex-col gap-3">
                {token.priceUsd != null && <div className="text-2xl font-semibold text-foreground">${token.priceUsd < 0.0001 ? token.priceUsd.toExponential(2) : token.priceUsd < 1 ? token.priceUsd.toFixed(6) : token.priceUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</div>}
                {token.priceChangeH24 != null && <span className={`text-sm font-semibold ${token.priceChangeH24 >= 0 ? "text-primary" : "text-destructive"}`}>{token.priceChangeH24 >= 0 ? "+" : ""}{token.priceChangeH24.toFixed(2)}% (24h)</span>}
                {(token.baseSymbol || token.quoteSymbol) && <p className="text-sm text-muted-foreground">{[token.baseSymbol, token.quoteSymbol].filter(Boolean).join(" / ")}</p>}
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  {token.liquidityUsd != null && <span>Liquidity: ${token.liquidityUsd >= 1e6 ? (token.liquidityUsd / 1e6).toFixed(2) + "M" : token.liquidityUsd >= 1e3 ? (token.liquidityUsd / 1e3).toFixed(2) + "K" : token.liquidityUsd.toFixed(0)}</span>}
                  {token.volumeH24 != null && <span>Vol 24h: ${token.volumeH24 >= 1e6 ? (token.volumeH24 / 1e6).toFixed(2) + "M" : token.volumeH24 >= 1e3 ? (token.volumeH24 / 1e3).toFixed(2) + "K" : token.volumeH24.toFixed(0)}</span>}
                </div>
                <a href={token.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">View on Dexscreener <ExternalLink className="h-4 w-4" /></a>
              </div>
            </div>
          </section>
        );
      case "team":
        if (profileType !== "company" || team.length === 0) return null;
        return (
          <section className={rightSectionSpacing}>
            <SectionTitle>Team</SectionTitle>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {team.map((member, i) => {
                const initials = member.name.trim() ? member.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() : "?";
                return (
                  <li key={i} className={`${sectionCardClass} p-4`}>
                    <div className="flex items-start gap-3">
                      {member.avatar_url ? <img src={member.avatar_url} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover border border-border" /> : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-sm font-semibold text-muted-foreground" aria-hidden>{initials}</div>}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">{member.name}</p>
                        {member.role && <p className="text-sm text-muted-foreground">{member.role}</p>}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {member.linkedin_url && <a href={member.linkedin_url} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent hover:text-primary"><IconLinkedIn /></a>}
                          {member.x_url && <a href={member.x_url} target="_blank" rel="noopener noreferrer" aria-label="X" className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent hover:text-primary"><IconX /></a>}
                          {member.website_url && <a href={member.website_url} target="_blank" rel="noopener noreferrer" aria-label="Website" className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-accent hover:text-primary"><Globe className="h-5 w-5" /></a>}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      case "relations":
        if (!relations) return null;
        if (profileType === "project" || profileType === "company") {
          if (!hasAnyRelation) {
            return (
              <section className={rightSectionSpacing}>
                <SectionTitle>Ecosystem</SectionTitle>
                <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
                  No partners added yet.
                </p>
              </section>
            );
          }
          return (
            <EcosystemModule
              relations={relations}
              basePath={basePath}
              sectionCardClass={sectionCardClass}
              rightSectionSpacing={rightSectionSpacing}
              SectionTitle={SectionTitle}
            />
          );
        }
        return (
          <>
            {relations.ambassadorOf && relations.ambassadorOf.length > 0 && (
              <section className={rightSectionSpacing}>
                <SectionTitle>Ambassador of</SectionTitle>
                <div className={`${sectionCardClass} p-4`}><div className="flex flex-wrap gap-2">{relations.ambassadorOf.map((item) => <RelationCardLink key={item.id} item={item} basePath={basePath} />)}</div></div>
              </section>
            )}
            {relations.affiliateOf && relations.affiliateOf.length > 0 && (
              <section className={rightSectionSpacing}>
                <SectionTitle>Affiliate of</SectionTitle>
                <div className={`${sectionCardClass} p-4`}><div className="flex flex-wrap gap-2">{relations.affiliateOf.map((item) => <RelationCardLink key={item.id} item={item} basePath={basePath} />)}</div></div>
              </section>
            )}
          </>
        );
      case "gigs": {
        if (profileType !== "project" && profileType !== "company") return null;
        const gigs = data.gigs ?? [];
        if (gigs.length === 0) {
          return (
            <section id="gigs" className={rightSectionSpacing}>
              <SectionTitle>Open gigs</SectionTitle>
              <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
                No open gigs yet.
              </p>
            </section>
          );
        }
        const openCount = gigs.length;
        const topGigs = gigs.slice(0, 2);
        const gigsAnchor = `${profileUrl}#gigs`;
        return (
          <section id="gigs" className={rightSectionSpacing}>
            <SectionTitle>Open gigs</SectionTitle>
            <p className="mb-4 text-sm font-medium text-foreground">Open gigs: {openCount}</p>
            {topGigs.length > 0 && (
              <ul className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Featured open gigs">
                {topGigs.map((gig) => (
                  <li key={gig.id} className={`${sectionCardClass} p-4`}>
                    <h3 className="font-semibold text-foreground">{gig.title}</h3>
                    {gig.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{gig.description}</p>}
                    {gig.budget_text && <p className="mt-1.5 text-sm font-medium text-primary">{gig.budget_text}</p>}
                    <a
                      href={gigsAnchor}
                      className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      View gig <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <ul className="space-y-3">
              {gigs.map((gig) => (
                <li key={gig.id} className={`${isShowcase ? featuredCardClass : sectionCardClass} p-4 ${isShowcase ? "p-5" : ""}`}>
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-foreground">{gig.title}</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium capitalize text-foreground">{gig.gig_type}</span>
                        <span className="rounded-lg border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium capitalize text-foreground">{gig.compensation_type}</span>
                        {gig.remote && <span className="rounded-lg border border-border bg-muted/50 px-2 py-0.5 text-xs">Remote</span>}
                      </div>
                      {gig.budget_text && <p className="mt-2 text-sm font-medium text-primary">{gig.budget_text}</p>}
                      {gig.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{gig.description}</p>}
                    </div>
                    <div className="shrink-0"><ApplyToGigButton gig={gig} ownerUsername={handle} basePath={basePath} /></div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      }
      case "skills":
        if (profileType !== "individual" && profileType !== "company") return null;
        return (
          <section className={rightSectionSpacing}>
            <SectionTitle>{profileType === "company" ? "Services / Expertise" : "Skills"}</SectionTitle>
            <div className={`${sectionCardClass} p-4`}>
              {skills.length === 0 ? (
                <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-center">{profileType === "company" ? "No services or expertise listed yet" : "No skills listed yet"}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {skills.map((s, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-foreground transition-all hover:border-primary/30 hover:bg-accent/50 hover:shadow-sm">
                      <span>{s.name}</span>
                      {s.level != null && s.level >= 1 && s.level <= 5 && <span className="text-xs text-muted-foreground tabular-nums" aria-label={`Level ${s.level} of 5`}>{s.level}/5</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        );
      case "achievements":
        if (profileType !== "individual") return null;
        return (
          <section className={rightSectionSpacing}>
            <SectionTitle>Achievements</SectionTitle>
            {achievements.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">No achievements yet</p>
            ) : (
              <ul className="space-y-3">
                {achievements.map((a, i) => (
                  <li key={i} className={`${sectionCardClass} p-4`}>
                    <h3 className="font-semibold text-foreground">{a.title}</h3>
                    {a.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{a.description}</p>}
                    {a.url && <a href={a.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">View <ExternalLink className="h-3.5 w-3.5" /></a>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      case "case_studies":
        return (
          <section className={rightSectionSpacing}>
            <SectionTitle>Case studies</SectionTitle>
            {caseStudies.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">Add a proof card to show outcomes.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
                {caseStudies.map((c) => {
                  const highlights = proofHighlights(c.summary ?? null, c.tags ?? []);
                  return (
                    <li key={c.id} className={isShowcase ? featuredCardClass : sectionCardClass}>
                      <div className={`flex flex-col h-full ${isShowcase ? "p-5" : "p-4"}`}>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          {c.title && <h3 className="font-semibold text-foreground">{c.title}</h3>}
                          {Array.isArray(c.tags) && c.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {c.tags.map((t) => (
                                <span key={t} className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-foreground">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {c.summary && (
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-3">{c.summary}</p>
                        )}
                        {highlights.length > 0 && (
                          <ul className="mt-3 space-y-1 text-sm text-foreground" aria-label="Highlights">
                            {highlights.map((h, i) => (
                              <li key={i} className="flex items-start gap-2">
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
                                <span>{h}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {c.url && (
                          <a
                            href={c.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          >
                            View case study <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      case "links":
        return (
          <section className={rightSectionSpacing}>
            <SectionTitle>Links</SectionTitle>
            {links.length === 0 ? (
              <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">No links yet</p>
            ) : (
              <ul className="space-y-2">
                {links.map((link, i) => {
                  const host = getHostname(link.url);
                  return (
                    <li key={i}>
                      <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left font-medium text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-accent/50 hover:shadow-md hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                        {link.icon ? <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50 overflow-hidden"><img src={link.icon} alt="" className="h-6 w-6 object-cover" /></span> : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/50"><Link2 className="h-5 w-5 text-muted-foreground" /></span>}
                        <div className="min-w-0 flex-1"><span className="block truncate">{link.title}</span>{host && <span className="block truncate text-xs text-muted-foreground">{host}</span>}</div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      case "reviews":
        if (!showReviews) return null;
        const sortedReviews =
          reviews.latest?.length > 0
            ? [...reviews.latest].sort((a, b) => {
                if (b.rating !== a.rating) return b.rating - a.rating;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              })
            : [];
        const topReview = sortedReviews[0] ?? null;
        const restReviews = sortedReviews.slice(1);
        return (
          <section className={rightSectionSpacing}>
            <SectionTitle>Reviews</SectionTitle>
            {reviews.count === 0 ? (
              <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">Verified reviews appear after completed deals.</p>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  {reviews.average != null && (
                    <div className="flex items-center gap-2">
                      <Stars rating={reviews.average} />
                      <span className="text-sm font-semibold text-foreground tabular-nums">{reviews.average.toFixed(1)}</span>
                    </div>
                  )}
                  <span className="text-sm text-muted-foreground">{reviews.count} verified review{reviews.count !== 1 ? "s" : ""}</span>
                </div>
                {topReview && (
                  <div className={`${sectionCardClass} border-primary/20 p-5`} aria-label="Top verified review">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top verified review</p>
                    <div className="flex gap-4">
                      {topReview.reviewer_avatar_url ? (
                        <img src={topReview.reviewer_avatar_url} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover border border-border ring-2 ring-primary/20 ring-offset-2 ring-offset-background" />
                      ) : (
                        <div className="h-12 w-12 shrink-0 rounded-full border border-border bg-muted ring-2 ring-primary/10 ring-offset-2 ring-offset-background" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">{topReview.reviewer_display ?? "Anonymous"}</span>
                          <Stars rating={topReview.rating} className="shrink-0" />
                          {topReview.verified_deal !== false && (
                            <span className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary shrink-0">Verified deal</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{new Date(topReview.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</p>
                        {topReview.title && <p className="mt-1.5 text-sm font-medium text-foreground">{topReview.title}</p>}
                        {topReview.text && <p className="mt-1 text-sm text-foreground leading-relaxed line-clamp-4">{topReview.text}</p>}
                      </div>
                    </div>
                  </div>
                )}
                {restReviews.length > 0 && (
                  <ul className="mt-4 space-y-3">
                    {restReviews.map((r, i) => (
                      <li key={r.id ?? i} className={`${sectionCardClass} p-4`}>
                        <div className="flex gap-3">
                          {r.reviewer_avatar_url ? (
                            <img src={r.reviewer_avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover border border-border" />
                          ) : (
                            <div className="h-10 w-10 shrink-0 rounded-full border border-border bg-muted" aria-hidden />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-foreground">{r.reviewer_display ?? "Anonymous"}</span>
                              <Stars rating={r.rating} className="shrink-0" />
                              {r.verified_deal !== false && (
                                <span className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary shrink-0">Verified deal</span>
                              )}
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</p>
                            {r.title && <p className="mt-1 text-sm font-medium text-foreground">{r.title}</p>}
                            {r.text && <p className="mt-0.5 text-sm text-foreground leading-relaxed line-clamp-3">{r.text}</p>}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        );
      case "hero":
        return null;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans relative">
      {/* Subtle background gradient / glow using tokens */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-primary/[0.03] via-transparent to-accent/[0.04] pointer-events-none" aria-hidden />
      <main className={`mx-auto max-w-6xl px-4 sm:px-6 ${isCompact ? "py-5 sm:py-6" : "py-8 sm:py-10"}`}>
        {/* Hero — full width; only when in visible order */}
        {visibleOrder.includes("hero") && (hasHeroImage || hasHeroVideo) && (
          <section className={isCompact ? "mb-5" : "mb-8"}>
            <div className={`overflow-hidden rounded-2xl border shadow-lg transition-all hover:border-primary/20 hover:shadow-primary/10 ${hasHeroImage ? "border-primary/20" : "border-border"} bg-card`}>
              {hasHeroImage && (
                <div className={`relative w-full ${isCompact ? "h-[140px] sm:h-[180px]" : "h-[200px] sm:h-[260px]"}`}>
                  <img
                    src={hero!.hero_image_url!}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-accent/15 to-transparent" aria-hidden />
                  {heroTitle && (
                    <div className="absolute bottom-0 left-0 right-0 p-5 pt-8">
                      <p className="text-xl font-bold tracking-tight text-white drop-shadow-lg sm:text-2xl" aria-hidden>
                        {heroTitle}
                      </p>
                      <div className="mt-2 h-1 w-24 rounded-full bg-accent shadow-sm" aria-hidden />
                    </div>
                  )}
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <CopyProfileLinkButton url={profileUrl} />
                    <a
                      href={profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-white/40 bg-white/20 px-3.5 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label="Open profile in new tab"
                    >
                      <Share2 className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              )}
              {hasHeroVideo && !hasHeroImage && (
                <div className="relative">
                  {hero!.hero_video_url!.startsWith("https://") && isYouTubeUrl(hero!.hero_video_url!) ? (
                    <div className="relative aspect-video w-full max-h-[300px] sm:max-h-[340px]">
                      <iframe
                        src={youtubeEmbedUrl(hero!.hero_video_url!)}
                        title="Hero video (YouTube)"
                        className="absolute inset-0 h-full w-full rounded-2xl"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-2 p-3 bg-gradient-to-t from-black/60 to-transparent rounded-b-2xl">
                        {heroTitle && <p className="text-sm font-medium text-white drop-shadow-md">{heroTitle}</p>}
                        <div className="flex gap-2 shrink-0">
                          <CopyProfileLinkButton url={profileUrl} />
                          <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/30 bg-black/40 px-2.5 text-xs text-white backdrop-blur-sm hover:bg-white/20" aria-label="Open in new tab"><Share2 className="h-3.5 w-3.5" /></a>
                        </div>
                      </div>
                      {heroTitle && <div className="absolute bottom-3 left-3 h-0.5 w-16 rounded-full bg-accent" aria-hidden />}
                    </div>
                  ) : hero!.hero_video_url!.startsWith("https://") && isVimeoUrl(hero!.hero_video_url!) ? (
                    <div className="relative aspect-video w-full max-h-[300px] sm:max-h-[340px]">
                      <iframe
                        src={vimeoEmbedUrl(hero!.hero_video_url!)}
                        title="Hero video (Vimeo)"
                        className="absolute inset-0 h-full w-full rounded-2xl"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                      />
                      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-2 p-3 bg-gradient-to-t from-black/60 to-transparent rounded-b-2xl">
                        {heroTitle && <p className="text-sm font-medium text-white drop-shadow-md">{heroTitle}</p>}
                        <div className="flex gap-2 shrink-0">
                          <CopyProfileLinkButton url={profileUrl} />
                          <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/30 bg-black/40 px-2.5 text-xs text-white backdrop-blur-sm hover:bg-white/20" aria-label="Open in new tab"><Share2 className="h-3.5 w-3.5" /></a>
                        </div>
                      </div>
                      {heroTitle && <div className="absolute bottom-3 left-3 h-0.5 w-16 rounded-full bg-accent" aria-hidden />}
                    </div>
                  ) : hero!.hero_video_url!.startsWith("https://") && isLoomUrl(hero!.hero_video_url!) ? (
                    <div className="relative aspect-video w-full max-h-[300px] sm:max-h-[340px]">
                      <iframe
                        src={loomEmbedUrl(hero!.hero_video_url!)}
                        title="Hero video (Loom)"
                        className="absolute inset-0 h-full w-full rounded-2xl"
                        allowFullScreen
                      />
                      <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between gap-2 p-3 bg-gradient-to-t from-black/60 to-transparent rounded-b-2xl">
                        {heroTitle && <p className="text-sm font-medium text-white drop-shadow-md">{heroTitle}</p>}
                        <div className="flex gap-2 shrink-0">
                          <CopyProfileLinkButton url={profileUrl} />
                          <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/30 bg-black/40 px-2.5 text-xs text-white backdrop-blur-sm hover:bg-white/20" aria-label="Open in new tab"><Share2 className="h-3.5 w-3.5" /></a>
                        </div>
                      </div>
                      {heroTitle && <div className="absolute bottom-3 left-3 h-0.5 w-16 rounded-full bg-accent" aria-hidden />}
                    </div>
                  ) : hero!.hero_video_url!.startsWith("https://") && isXVideoUrl(hero!.hero_video_url!) ? (
                    <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-muted/80 to-muted/40 p-6 border border-border">
                      <div className="rounded-2xl border-2 border-primary/30 bg-primary/10 p-6 flex flex-col items-center gap-2">
                        <IconX />
                        <span className="text-lg font-bold text-foreground">Watch on X</span>
                      </div>
                      <a
                        href={hero!.hero_video_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-primary bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                        Watch on X
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      {heroTitle && <p className="text-sm text-muted-foreground text-center">{heroTitle}</p>}
                      <div className="flex gap-2">
                        <CopyProfileLinkButton url={profileUrl} />
                        <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-sm text-foreground hover:bg-accent/50" aria-label="Open in new tab"><Share2 className="h-4 w-4" /></a>
                      </div>
                    </div>
                  ) : (
                    <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 rounded-2xl bg-gradient-to-br from-muted/80 to-muted/40 p-6 border border-border">
                      <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-6">
                        <span className="text-4xl font-bold text-primary">Play</span>
                      </div>
                      <a
                        href={hero!.hero_video_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-primary bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition hover:bg-primary/90 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                        Watch
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <div className="flex gap-2">
                        <CopyProfileLinkButton url={profileUrl} />
                        <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-sm text-foreground hover:bg-accent/50" aria-label="Open in new tab"><Share2 className="h-4 w-4" /></a>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {heroTitle && hasHeroImage === false && hasHeroVideo && !(hero!.hero_video_url!.startsWith("https://") && (isYouTubeUrl(hero!.hero_video_url!) || isVimeoUrl(hero!.hero_video_url!) || isLoomUrl(hero!.hero_video_url!))) && (
              <p className="mt-2 text-sm text-muted-foreground" aria-hidden>{heroTitle}</p>
            )}
          </section>
        )}

        {/* Layout: classic/showcase = 2-col; spotlight = single column stacked; compact = 2-col tighter */}
        <div className={
          isSpotlight
            ? "space-y-8"
            : `lg:grid lg:gap-10 lg:items-start ${isCompact ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-6" : "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"}`
        }>
          {isSpotlight ? (
            <div className="space-y-8">
              {visibleOrder.filter((k) => k !== "hero").map((key) => {
                const node = renderSection(key);
                return node != null ? <Fragment key={key}>{node}</Fragment> : null;
              })}
            </div>
          ) : (
            <>
              <div className={`space-y-6 ${!isSpotlight ? "lg:sticky lg:top-6" : ""}`}>
                {leftOrder.map((key) => {
                  const node = renderSection(key);
                  return node != null ? <Fragment key={key}>{node}</Fragment> : null;
                })}
              </div>
              <div className="space-y-8 lg:pt-0">
                {rightOrder.map((key) => {
                  const node = renderSection(key);
                  return node != null ? <Fragment key={key}>{node}</Fragment> : null;
                })}
              </div>
            </>
          )}
        </div>

        <footer className="mt-12 pt-8 text-center border-t border-border">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-primary transition hover:bg-accent/50 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Linkary
          </Link>
        </footer>
      </main>
    </div>
  );
}