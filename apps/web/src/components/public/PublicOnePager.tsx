"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, ExternalLink, Globe, GripVertical, Link2, Save, Share2, X } from "lucide-react";
import type { PublicEntity } from "@/lib/publicData";
import type { PublicEntityView } from "@/lib/publicProfileDTO";
import { getProfileSectionOrder, getOrgSectionOrder } from "@/lib/publicLayoutDefaults";
import dynamic from "next/dynamic";
import { PublicHeader } from "./PublicHeader";
import { MetricCard } from "./MetricCard";
import { CaseStudyCard } from "./CaseStudyCard";

const StickyClaimBar = dynamic(
  () => import("./StickyClaimBar").then((m) => ({ default: m.StickyClaimBar })),
  { ssr: false }
);
import { EcosystemSections } from "./EcosystemSections";
import { DexScreenerEmbed } from "./DexScreenerEmbed";
import { HeroMedia } from "./HeroMedia";
import { supabase } from "@/lib/supabase";
import { isPrivateStorageUrl } from "@/lib/isPrivateStorageUrl";

/** Minimal fade-in on scroll (once). */
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setVisible(true);
      },
      { threshold: 0.05, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 flex items-center gap-3 text-lg font-semibold text-foreground">
      <span className="h-5 w-0.5 shrink-0 self-stretch rounded-full bg-primary/80" aria-hidden />
      {children}
    </h2>
  );
}

function FadeInSection({ children, className }: { children: React.ReactNode; className?: string }) {
  const { ref, visible } = useFadeIn();
  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

type Props = {
  entity: PublicEntity | PublicEntityView;
  username: string;
  isLoggedIn: boolean;
  isOwner?: boolean;
  analyticsSource?: "worker" | "partial" | "fallback";
  analyticsInitialized?: boolean;
  hasXConnected?: boolean;
  brochure?: boolean;
};

const socialIconSize = 20;

/** Primary color thresholds: only show metric in primary when it meets the bar (credibility). */
const ETHOS_PRIMARY_THRESHOLD = 1200;
const XSCORE_PRIMARY_THRESHOLD = 60;
const LINKARY_PRIMARY_THRESHOLD = 60;

function reputationMetricClass(value: number | null | undefined, threshold: number): string {
  if (value == null) return "text-muted-foreground";
  return value >= threshold ? "text-primary" : "text-foreground";
}

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

function IconYouTube() {
  return (
    <svg width={socialIconSize} height={socialIconSize} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
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

function SocialIcon({ name, url }: { name: string; url: string }) {
  const icon =
    name === "X" ? (
      <IconX />
    ) : name === "LinkedIn" ? (
      <IconLinkedIn />
    ) : name === "YouTube" ? (
      <IconYouTube />
    ) : name === "Telegram" ? (
      <IconTelegram />
    ) : (
      <Globe className="size-5 shrink-0" aria-hidden />
    );
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center rounded-md p-2 text-foreground hover:bg-accent hover:text-primary min-h-[2.25rem] min-w-[2.25rem] transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      aria-label={name}
    >
      {icon}
    </a>
  );
}

function SocialsRow({ entity }: { entity: PublicEntityView | PublicEntity }) {
  const socials = entity.socials;
  if (!socials) return null;
  const links: { name: string; url: string | null }[] = [
    { name: "X", url: socials.x_url },
    { name: "LinkedIn", url: socials.linkedin_url },
    { name: "YouTube", url: socials.youtube_url },
    { name: "Website", url: socials.website_url },
    { name: "Telegram", url: socials.telegram_url },
  ].filter((l): l is { name: string; url: string } => l.url != null);
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3" data-cursor-element-id="cursor-el-1">
      {links.map((l) => (
        <SocialIcon key={l.name} name={l.name} url={l.url} />
      ))}
    </div>
  );
}

function labelForDelta(value: number | null | undefined): "Good" | "Watch" | "Risk" | "Estimate" | null {
  if (value == null || !Number.isFinite(value)) return "Estimate";
  if (value >= 0) return "Good";
  return "Watch";
}

export function PublicOnePager({ entity, username, isLoggedIn, isOwner = false, analyticsSource, analyticsInitialized, hasXConnected = false, brochure = false }: Props) {
  const router = useRouter();
  const isProfile = entity.type === "profile";
  const profile = entity.profile;
  const org = entity.org;
  const displayName = isProfile ? profile?.display_name ?? username : org?.name ?? username;
  const bio = isProfile ? profile?.bio : org?.tagline;
  const rawAvatarUrl = isProfile ? profile?.avatar_url : org?.logo_url;
  const avatarUrl = rawAvatarUrl && !isPrivateStorageUrl(rawAvatarUrl) ? rawAvatarUrl : null;
  const tier = entity.tier;
  const caseStudies = tier === "pro" ? entity.caseStudies : entity.caseStudies.slice(0, 2);
  const reviews = tier === "pro" ? entity.reviews : entity.reviews.slice(0, 2);
  const avgRating =
    entity.reviews.length > 0
      ? entity.reviews.reduce((a, r) => a + r.rating, 0) / entity.reviews.length
      : null;
  const snap = entity.analyticsSnapshot;

  const defaultOrder = isProfile ? getProfileSectionOrder(undefined) : getOrgSectionOrder(undefined);
  const savedOrder = entity.publicLayout?.order;
  const displayOrder = savedOrder?.length ? savedOrder : defaultOrder;

  const [layoutEditMode, setLayoutEditMode] = useState(false);
  const [localOrder, setLocalOrder] = useState<string[]>(displayOrder);
  const [savingLayout, setSavingLayout] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [usernameCopied, setUsernameCopied] = useState(false);
  const [viewerLinkCopied, setViewerLinkCopied] = useState(false);
  const [brochureLinkCopied, setBrochureLinkCopied] = useState(false);

  const brochureUrl = typeof window !== "undefined" ? `${window.location.origin}/${encodeURIComponent(username)}?view=brochure` : "";
  const handleCopyBrochureLink = useCallback(() => {
    if (!brochureUrl) return;
    navigator.clipboard.writeText(brochureUrl).then(() => {
      setBrochureLinkCopied(true);
      setTimeout(() => setBrochureLinkCopied(false), 2000);
    });
  }, [brochureUrl]);

  const handleCopyProfileLink = useCallback(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/${encodeURIComponent(username)}`;
    navigator.clipboard.writeText(url).then(() => {
      setUsernameCopied(true);
      setTimeout(() => setUsernameCopied(false), 2000);
    });
  }, [username]);

  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/${encodeURIComponent(username)}` : "";
  const shareOnXUrl = publicUrl
    ? `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Found this reputation profile on Linkary: ${publicUrl}`)}`
    : "";
  const handleViewerCopyLink = useCallback(() => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setViewerLinkCopied(true);
      setTimeout(() => setViewerLinkCopied(false), 2000);
    });
  }, [publicUrl]);

  const lastUpdatedRelative = (() => {
    const dates: string[] = [];
    entity.caseStudies?.forEach((c) => c.created_at && dates.push(c.created_at));
    entity.reviews?.forEach((r) => (r as { created_at?: string }).created_at && dates.push((r as { created_at: string }).created_at));
    if (dates.length === 0) return null;
    const latest = new Date(Math.max(...dates.map((d) => new Date(d).getTime())));
    const now = new Date();
    const diffMs = now.getTime() - latest.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    return diffDays === 0 ? "today" : diffDays === 1 ? "yesterday" : diffDays < 30 ? `${diffDays}d ago` : latest.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  })();

  const handleSaveLayout = useCallback(async () => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;
    setSavingLayout(true);
    const entityType = entity.type;
    const profileId = (entity as PublicEntity).profile?.id;
    const orgId = (entity as PublicEntity).org?.id;
    const body = profileId != null || orgId != null
      ? { entityType, entityId: entityType === "profile" ? profileId : orgId, layout: { order: localOrder } }
      : { entityType, username, layout: { order: localOrder } };
    const res = await fetch("/api/public/layout", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    setSavingLayout(false);
    if (res.ok) {
      setLayoutEditMode(false);
      router.refresh();
    }
  }, [entity, username, localOrder, router]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDragIndex(index);
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (Number.isNaN(from) || from === dropIndex) {
      setDragIndex(null);
      return;
    }
    const next = [...localOrder];
    const [removed] = next.splice(from, 1);
    next.splice(dropIndex, 0, removed);
    setLocalOrder(next);
    setDragIndex(null);
  };

  const orderedSectionIds = layoutEditMode ? localOrder : displayOrder;
  const hiddenSet = new Set(entity.publicLayout?.hidden ?? []);

  const hasSocials = entity.socials && [
    entity.socials.x_url,
    entity.socials.linkedin_url,
    entity.socials.youtube_url,
    entity.socials.website_url,
    entity.socials.telegram_url,
  ].some((u) => u && u.trim());
  const orgWebsite = !isProfile && org?.website;
  const orgTwitter = !isProfile && org?.twitter_username;

  return (
    <div className={`min-h-screen bg-background text-foreground font-sans ${brochure ? "pb-16" : ""}`}>
      {brochure && (
        <div className="sticky top-0 z-50 flex justify-end p-3 border-b border-border bg-background/95 backdrop-blur-sm">
          <button
            type="button"
            onClick={handleCopyBrochureLink}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={brochureLinkCopied ? "Brochure link copied" : "Copy brochure link"}
          >
            <Link2 className="h-4 w-4" />
            {brochureLinkCopied ? "Copied" : "Copy brochure link"}
          </button>
        </div>
      )}
      <PublicHeader entity={entity} username={username} isLoggedIn={isLoggedIn} isOwner={brochure ? false : isOwner} brochure={brochure} />

      <main className={`mx-auto max-w-6xl px-4 sm:px-6 pb-20 ${brochure ? "py-8 sm:py-12" : "py-6 sm:py-8"}`}>
        {isOwner && !brochure && (
          <div className="mb-6 flex items-center gap-2">
            {!layoutEditMode ? (
              <button
                type="button"
                onClick={() => {
                  setLayoutEditMode(true);
                  setLocalOrder(displayOrder);
                }}
                className="rounded-md bg-muted/80 px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Edit Layout
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSaveLayout}
                  disabled={savingLayout}
                  className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {savingLayout ? "Saving…" : "Save order"}
                </button>
                <button
                  type="button"
                  onClick={() => { setLayoutEditMode(false); setLocalOrder(displayOrder); }}
                  className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </>
            )}
          </div>
        )}

        {/* Hero strip: video or image (brochure dashboard) */}
        <section className="mb-8">
          <HeroMedia
            type={entity.headerMedia?.header_media_type ?? "NONE"}
            url={
              entity.headerMedia?.header_media_url && !isPrivateStorageUrl(entity.headerMedia.header_media_url)
                ? entity.headerMedia.header_media_url
                : null
            }
            alt={displayName ?? undefined}
          />
        </section>

        {/* Profile: name, @username, bio, identity, trust, socials */}
        <section className="pb-6 border-b border-border">
          <div className="flex items-start gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                className="h-20 w-20 shrink-0 rounded-2xl object-cover"
              />
            ) : (
              <div className="h-20 w-20 shrink-0 rounded-2xl bg-muted" />
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold text-foreground">{displayName}</h1>
              <button
                type="button"
                onClick={handleCopyProfileLink}
                className="text-sm text-primary hover:underline cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded px-0.5 -ml-0.5"
                aria-label={usernameCopied ? "Link copied" : "Copy profile link"}
              >
                {usernameCopied ? "Copied!" : `@${username}`}
              </button>
              {bio && <p className="mt-2 text-sm text-muted-foreground">{bio}</p>}
              {profile?.location && (
                <p className="mt-1 text-xs text-muted-foreground">{profile.location}</p>
              )}
            </div>
          </div>

          {/* Identity Bar: confident badge + credibility line */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            {hasXConnected ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                Verified via X
              </span>
            ) : <span />}
            <span className="text-sm font-medium text-foreground">
              {hasXConnected && analyticsInitialized ? "Verified analytics & credibility" : "Public reputation profile"}
            </span>
          </div>

          {/* Trust sentence (micro content) */}
          <p className="mt-3 text-sm text-muted-foreground">
            {hasXConnected && analyticsInitialized && (
              <>90-day activity <span className="text-primary">verified</span>. Followers tracked since Linkary connection.</>
            )}
            {hasXConnected && !analyticsInitialized && (
              <>Building 90-day activity <span className="text-primary">verification</span> now. This takes a few minutes.</>
            )}
            {!hasXConnected && (
              <>Connect X to activate <span className="text-primary">verified</span> analytics and reputation signals.</>
            )}
          </p>

          {/* Socials under profile */}
          {(hasSocials || orgWebsite || orgTwitter) && (
            <nav className="mt-6 flex flex-wrap items-center gap-2 sm:gap-3" aria-label="Social links">
              {hasSocials && <SocialsRow entity={entity} />}
              {orgWebsite && (
                <a
                  href={orgWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-primary transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label="Website"
                >
                  Website
                </a>
              )}
              {orgTwitter && (
                <a
                  href={`https://x.com/${orgTwitter.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-primary transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label="X profile"
                >
                  X
                </a>
              )}
            </nav>
          )}

        </section>

        {/* 4 stat cards (brochure dashboard) */}
        <section className="py-8" aria-label="Reputation Signals">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {isProfile && (
              <>
                <div className="rounded-md border border-border bg-background p-4">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide" title="Community credibility score">ETHOS</div>
                  <div className={`mt-1 text-3xl font-semibold tabular-nums ${reputationMetricClass(entity.ethosScore ?? null, ETHOS_PRIMARY_THRESHOLD)}`}>{entity.ethosScore ?? "—"}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Community credibility score</p>
                </div>
                <div className="rounded-md border border-border bg-background p-4">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide" title="Engagement-based influence">XScore</div>
                  <div className={`mt-1 text-3xl font-semibold tabular-nums ${reputationMetricClass(profile?.xscore ?? null, XSCORE_PRIMARY_THRESHOLD)}`}>{profile?.xscore ?? "—"}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Engagement-based influence</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Stored value (manual until Wallchain sync)</p>
                </div>
                <div className="rounded-md border border-border bg-background p-4">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide" title="Overall profile strength">Linkary</div>
                  <div className={`mt-1 text-3xl font-semibold tabular-nums ${reputationMetricClass(entity.linkaryPower ?? null, LINKARY_PRIMARY_THRESHOLD)}`}>{entity.linkaryPower ?? "—"}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Overall profile strength</p>
                </div>
                <div className="rounded-md border border-border bg-background p-4">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Verified Proof</div>
                  {(() => {
                    const proofCount = entity.caseStudies.length + entity.reviews.length;
                    return proofCount > 0 ? (
                      <>
                        <div className={`mt-1 text-3xl font-semibold tabular-nums ${reputationMetricClass(proofCount, 1)}`}>{proofCount} Proof {proofCount === 1 ? "Item" : "Items"}</div>
                        <p className="mt-1 text-xs text-muted-foreground">Case studies + verified collabs</p>
                      </>
                    ) : (
                      <>
                        <div className="mt-1 text-3xl font-semibold tabular-nums text-muted-foreground">—</div>
                        <p className="mt-1 text-xs text-muted-foreground">Add proof to boost credibility</p>
                      </>
                    );
                  })()}
                </div>
              </>
            )}
            {!isProfile && org && (
              <>
                <div className="rounded-md border border-border bg-background p-4">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">XScore</div>
                  <div className={`mt-1 text-3xl font-semibold tabular-nums ${reputationMetricClass(org.xscore ?? null, XSCORE_PRIMARY_THRESHOLD)}`}>{org.xscore ?? "—"}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Engagement-based influence</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">Stored value (manual until Wallchain sync)</p>
                </div>
                <div className="rounded-md border border-border bg-background p-4">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Linkary</div>
                  <div className={`mt-1 text-3xl font-semibold tabular-nums ${reputationMetricClass(entity.linkaryInfluence ?? null, LINKARY_PRIMARY_THRESHOLD)}`}>{entity.linkaryInfluence ?? "—"}</div>
                  <p className="mt-1 text-xs text-muted-foreground">Overall profile strength</p>
                </div>
                <div className="rounded-md border border-border bg-background p-4">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Verified Proof</div>
                  {(() => {
                    const proofCount = entity.caseStudies.length + entity.reviews.length;
                    return proofCount > 0 ? (
                      <>
                        <div className={`mt-1 text-3xl font-semibold tabular-nums text-primary`}>{proofCount} Proof {proofCount === 1 ? "Item" : "Items"}</div>
                        <p className="mt-1 text-xs text-muted-foreground">Case studies + verified collabs</p>
                      </>
                    ) : (
                      <>
                        <div className="mt-1 text-3xl font-semibold tabular-nums text-muted-foreground">—</div>
                        <p className="mt-1 text-xs text-muted-foreground">Add proof to boost credibility</p>
                      </>
                    );
                  })()}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Share strip (brochure) */}
        <div className="flex flex-wrap items-center justify-between gap-3 py-4 border-y border-border">
          <p className="text-sm text-muted-foreground">Share this as your one-page brochure</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleViewerCopyLink}
              className="inline-flex items-center gap-1.5 rounded-md bg-muted/80 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={viewerLinkCopied ? "Link copied" : "Copy link"}
            >
              <Link2 className="h-4 w-4" />
              {viewerLinkCopied ? "Copied" : "Copy link"}
            </button>
            {shareOnXUrl && (
              <a
                href={shareOnXUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-muted/80 px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label="Share on X"
              >
                <Share2 className="h-4 w-4" />
                Share on X
              </a>
            )}
          </div>
        </div>

        {/* 2-column: Proof (Case Studies) | Partners & programs (brochure) */}
        <section className="py-8 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10">
          <div>
            <h2 className="mb-2 flex items-center gap-3 text-lg font-semibold text-foreground">
              <span className="h-5 w-0.5 shrink-0 self-stretch rounded-full bg-primary/80" aria-hidden />
              Case Studies
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">Proof and outcomes</p>
            {caseStudies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No case studies yet.</p>
            ) : (
              <div className="space-y-3">
                {caseStudies.slice(0, 4).map((cs) => (
                  <div key={cs.id} className="transition-transform duration-200 hover:scale-[1.02]">
                    <CaseStudyCard title={cs.title} description={cs.description} proofUrl={cs.proof_url} metrics={(cs as { metrics?: Record<string, unknown> }).metrics} createdAt={cs.created_at} />
                  </div>
                ))}
                {entity.caseStudies.length > 4 && <p className="text-sm text-muted-foreground">View all on profile.</p>}
              </div>
            )}
          </div>
          <div>
            <h2 className="mb-2 flex items-center gap-3 text-lg font-semibold text-foreground">
              <span className="h-5 w-0.5 shrink-0 self-stretch rounded-full bg-primary/80" aria-hidden />
              Partners & programs
            </h2>
            <p className="mb-4 text-sm text-muted-foreground">Affiliates and ambassador programs</p>
            {isProfile && (entity.affiliates?.length > 0 || entity.ambassadors?.length > 0) ? (
              <ul className="space-y-3">
                {entity.affiliates.map((aff, i) => (
                  <li key={`aff-${i}-${aff.name}`} className="flex items-center gap-3 rounded-md border border-border bg-background p-3 transition-transform duration-200 hover:scale-[1.02]">
                    {aff.logo_url && !isPrivateStorageUrl(aff.logo_url) && <img src={aff.logo_url} alt="" className="h-10 w-10 rounded-md object-cover shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">{aff.name}</div>
                      {aff.description && <div className="text-xs text-muted-foreground line-clamp-2">{aff.description}</div>}
                      <div className="text-xs text-muted-foreground">{aff.since_date ? `Since ${aff.since_date}` : "Affiliate"}</div>
                    </div>
                    {aff.website_url ? (
                      <a href={aff.website_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary rounded">Visit</a>
                    ) : null}
                    <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Affiliate</span>
                    {aff.is_featured && <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Featured</span>}
                  </li>
                ))}
                {entity.ambassadors.map((amb, i) => (
                  <li key={`amb-${i}-${amb.name}`} className="flex items-center gap-3 rounded-md border border-border bg-background p-3 transition-transform duration-200 hover:scale-[1.02]">
                    {amb.logo_url && !isPrivateStorageUrl(amb.logo_url) && <img src={amb.logo_url} alt="" className="h-10 w-10 rounded-md object-cover shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">{amb.name}</div>
                      {amb.description && <div className="text-xs text-muted-foreground line-clamp-2">{amb.description}</div>}
                      <div className="text-xs text-muted-foreground">{amb.since_date ? `Since ${amb.since_date}` : "Ambassador"}</div>
                    </div>
                    {amb.website_url ? (
                      <a href={amb.website_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary rounded">Visit</a>
                    ) : null}
                    <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Ambassador</span>
                    {amb.is_featured && <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Featured</span>}
                  </li>
                ))}
              </ul>
            ) : isProfile && isOwner ? (
              <p className="text-sm text-muted-foreground">Add partner programs to showcase credibility.</p>
            ) : !isProfile && (entity.affiliates?.length > 0 || entity.ambassadors?.length > 0) ? (
              <ul className="space-y-3">
                {entity.affiliates.map((aff, i) => (
                  <li key={`aff-${i}-${aff.name}`} className="flex items-center gap-3 rounded-md border border-border bg-background p-3 transition-transform duration-200 hover:scale-[1.02]">
                    {aff.logo_url && !isPrivateStorageUrl(aff.logo_url) && <img src={aff.logo_url} alt="" className="h-10 w-10 rounded-md object-cover shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">{aff.name}</div>
                      {aff.description && <div className="text-xs text-muted-foreground line-clamp-2">{aff.description}</div>}
                      <div className="text-xs text-muted-foreground">{aff.since_date ? `Since ${aff.since_date}` : "Affiliate"}</div>
                    </div>
                    {aff.website_url ? (
                      <a href={aff.website_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary rounded">Visit</a>
                    ) : null}
                    <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Affiliate</span>
                    {aff.is_featured && <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Featured</span>}
                  </li>
                ))}
                {entity.ambassadors.map((amb, i) => (
                  <li key={`amb-${i}-${amb.name}`} className="flex items-center gap-3 rounded-md border border-border bg-background p-3 transition-transform duration-200 hover:scale-[1.02]">
                    {amb.logo_url && !isPrivateStorageUrl(amb.logo_url) && <img src={amb.logo_url} alt="" className="h-10 w-10 rounded-md object-cover shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">{amb.name}</div>
                      {amb.description && <div className="text-xs text-muted-foreground line-clamp-2">{amb.description}</div>}
                      <div className="text-xs text-muted-foreground">{amb.since_date ? `Since ${amb.since_date}` : "Ambassador"}</div>
                    </div>
                    {amb.website_url ? (
                      <a href={amb.website_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sm text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary rounded">Visit</a>
                    ) : null}
                    <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Ambassador</span>
                    {amb.is_featured && <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Featured</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No partner programs listed.</p>
            )}
          </div>
        </section>

        {/* Reorderable sections (order from public_layout or default; caseStudies & affiliates rendered above) */}
        {orderedSectionIds.map((sectionId, index) => {
          if (hiddenSet.has(sectionId) || sectionId === "caseStudies" || sectionId === "affiliates") return null;
          const sectionContent = (() => {
            switch (sectionId) {
              case "socials":
                return null;
              case "analytics":
                if (!isProfile) return null;
                if (!hasXConnected) {
                  return (
                    <section className="py-6 border-t border-border">
                      <FadeInSection>
                        <p className="text-sm text-muted-foreground">Connect X to enable analytics</p>
                      </FadeInSection>
                    </section>
                  );
                }
                if (!snap && !analyticsInitialized) {
                  return (
                    <section className="py-6 border-t border-border">
                      <FadeInSection>
                        <SectionTitle>30d Activity</SectionTitle>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <div key={i} className="rounded-md border border-border p-4 animate-pulse">
                            <div className="h-4 w-16 rounded bg-muted" />
                            <div className="mt-2 h-8 w-20 rounded bg-muted" />
                          </div>
                        ))}
                      </div>
                      </FadeInSection>
                    </section>
                  );
                }
                const showPartialBanner = hasXConnected && (analyticsSource === "partial" || analyticsSource === "fallback");
                return (
                  <section className="py-6 border-t border-border">
                    <FadeInSection>
                    {showPartialBanner && (
                      <p className="mb-4 text-sm text-muted-foreground">
                        90-day history is building. Activity history is real; follower growth tracked since connection.
                      </p>
                    )}
                    <SectionTitle>30d Activity</SectionTitle>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <MetricCard label="Average Reach" value={snap?.reach_avg != null ? Number(snap.reach_avg).toLocaleString() : "—"} status={snap ? labelForDelta(snap.reach_avg) : null} />
                      <MetricCard label="Engagement Rate" value={snap?.engagement_rate != null ? `${(Number(snap.engagement_rate) * 100).toFixed(2)}%` : "—"} status={snap ? labelForDelta(snap.engagement_rate) : null} />
                      <MetricCard label="Avg Likes/Post" value={snap?.likes_avg != null ? Number(snap.likes_avg).toLocaleString() : "—"} />
                      <MetricCard label="Avg Replies/Post" value={snap?.replies_avg != null ? Number(snap.replies_avg).toLocaleString() : "—"} />
                      <MetricCard label="X Spaces Hosted" value={snap?.spaces_count ?? "—"} />
                      <MetricCard label="Followers Growth" value={snap?.followers_delta != null ? `${snap.followers_delta > 0 ? "+" : ""}${snap.followers_delta}` : "—"} status={snap ? labelForDelta(snap.followers_delta) : null} />
                    </div>
                    </FadeInSection>
                  </section>
                );
              case "affiliates":
                if (isProfile && (entity.affiliates?.length > 0 || entity.ambassadors?.length > 0)) {
                  return (
                    <section className="py-6 border-t border-border">
                      <FadeInSection>
                        <SectionTitle>Partners & programs</SectionTitle>
                        <p className="mb-4 text-sm text-muted-foreground">Affiliates and ambassador programs</p>
                        <ul className="space-y-3">
                          {entity.affiliates.map((aff, i) => (
                            <li key={`aff-${i}-${aff.name}`} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0 transition-transform duration-200 hover:scale-[1.02]">
                              {aff.logo_url && !isPrivateStorageUrl(aff.logo_url) && <img src={aff.logo_url} alt="" className="h-10 w-10 rounded-md object-cover" />}
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-foreground">{aff.name}</div>
                                {aff.description && <div className="text-xs text-muted-foreground line-clamp-2">{aff.description}</div>}
                                <div className="text-xs text-muted-foreground">Affiliate{aff.since_date ? ` since ${aff.since_date}` : ""}</div>
                              </div>
                              {aff.is_featured && <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Featured</span>}
                              <BadgeCheck className="h-5 w-5 shrink-0 text-primary" />
                            </li>
                          ))}
                          {entity.ambassadors.map((amb, i) => (
                            <li key={`amb-${i}-${amb.name}`} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0 transition-transform duration-200 hover:scale-[1.02]">
                              {amb.logo_url && !isPrivateStorageUrl(amb.logo_url) && <img src={amb.logo_url} alt="" className="h-10 w-10 rounded-md object-cover" />}
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-foreground">{amb.name}</div>
                                {amb.description && <div className="text-xs text-muted-foreground line-clamp-2">{amb.description}</div>}
                                <div className="text-xs text-muted-foreground">Ambassador{amb.since_date ? ` since ${amb.since_date}` : ""}</div>
                              </div>
                              {amb.is_featured && <span className="shrink-0 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Featured</span>}
                              <BadgeCheck className="h-5 w-5 shrink-0 text-primary" />
                            </li>
                          ))}
                        </ul>
                      </FadeInSection>
                    </section>
                  );
                }
                if (!isProfile && (entity.affiliates?.length > 0 || entity.ambassadors?.length > 0)) return null;
                return null;
              case "caseStudies":
                if (caseStudies.length === 0) return null;
                const caseStudyCount = entity.caseStudies.length;
                const verifiedReviewCount = entity.reviews.length;
                const proofParts: string[] = [];
                if (caseStudyCount > 0) proofParts.push(`Proof: ${caseStudyCount} case ${caseStudyCount === 1 ? "study" : "studies"}`);
                if (verifiedReviewCount > 0) proofParts.push(`Verified: ${verifiedReviewCount} collaboration${verifiedReviewCount === 1 ? "" : "s"}`);
                if (lastUpdatedRelative) proofParts.push(`Updated: ${lastUpdatedRelative}`);
                return (
                  <section className="py-6 border-t border-border">
                    <FadeInSection>
                      <SectionTitle>Case Studies</SectionTitle>
                      {proofParts.length > 0 && (
                        <p className="mb-2 text-xs text-muted-foreground">{proofParts.join(" · ")}</p>
                      )}
                      <p className="mb-4 text-sm text-muted-foreground">Verified outcomes and collaborations.</p>
                      <div className="space-y-3">
                        {caseStudies.map((cs) => (
                          <div key={cs.id} className="transition-transform duration-200 hover:scale-[1.02]">
                            <CaseStudyCard title={cs.title} description={cs.description} proofUrl={cs.proof_url} metrics={(cs as { metrics?: Record<string, unknown> }).metrics} createdAt={cs.created_at} />
                          </div>
                        ))}
                      </div>
                      {tier === "pro" && entity.caseStudies.length > 3 && <p className="mt-2 text-sm text-muted-foreground">View all on profile.</p>}
                    </FadeInSection>
                  </section>
                );
              case "reviews":
                return (
                  <section className="py-6 border-t border-border">
                    <FadeInSection>
                      <SectionTitle>Reviews</SectionTitle>
                    {avgRating != null && <p className="mb-4 text-sm text-muted-foreground">{avgRating.toFixed(1)} average · {entity.reviews.length} verified reviews</p>}
                    <ul className="space-y-0">
                      {reviews.map((r) => (
                        <li key={r.id} className="py-3 border-b border-border/50 last:border-0">
                          <div className="text-sm font-medium text-foreground">{r.rating}/5 {r.title ?? ""}</div>
                          {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
                        </li>
                      ))}
                    </ul>
                    </FadeInSection>
                  </section>
                );
              case "ethos":
                if (!entity.ethosResults || Object.keys(entity.ethosResults).length === 0) return null;
                return (
                  <section className="py-6 border-t border-border">
                    <FadeInSection>
                      <SectionTitle>Ethos Results</SectionTitle>
                    <ul className="list-inside list-disc space-y-1 text-sm text-foreground">
                      {Object.entries(entity.ethosResults).map(([key, value]) => (
                        <li key={key}>{key}: {typeof value === "object" ? JSON.stringify(value) : String(value)}</li>
                      ))}
                    </ul>
                    </FadeInSection>
                  </section>
                );
              case "about":
                if (isProfile) return null;
                if (!bio && !org?.website) return null;
                return (
                  <section className="py-6 border-t border-border">
                    <FadeInSection>
                      <SectionTitle>About</SectionTitle>
                    {bio && <p className="text-foreground">{bio}</p>}
                    </FadeInSection>
                  </section>
                );
              case "ecosystem":
                if (isProfile || entity.ecosystemCategories.length === 0) return null;
                return (
                  <section className="py-6 border-t border-border">
                    <FadeInSection>
                      <EcosystemSections categories={entity.ecosystemCategories} />
                    </FadeInSection>
                  </section>
                );
              case "token":
                if (isProfile || !entity.dexscreenerUrl) return null;
                const orgWithToken = org && "is_crypto_project" in org && "has_token" in org ? org : null;
                if (!orgWithToken?.is_crypto_project || !orgWithToken?.has_token) return null;
                return (
                  <section className="py-6 border-t border-border">
                    <FadeInSection>
                      <DexScreenerEmbed dexscreenerUrl={entity.dexscreenerUrl} tokenSymbol={entity.tokenSymbol} />
                    </FadeInSection>
                  </section>
                );
              case "subsidiaries":
                if (isProfile || entity.subsidiaries.length === 0) return null;
                return (
                  <section className="py-6 border-t border-border">
                    <FadeInSection>
                      <SectionTitle>Subsidiaries</SectionTitle>
                    <ul className="space-y-0">
                      {entity.subsidiaries.map((sub) => (
                        <li key={sub.id} className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
                          {sub.logo_url && !isPrivateStorageUrl(sub.logo_url) && <img src={sub.logo_url} alt="" className="h-12 w-12 rounded-md object-cover" />}
                          <div>
                            <div className="font-medium text-foreground">{sub.name}</div>
                            <p className="text-xs text-muted-foreground">@{sub.slug}</p>
                          </div>
                        </li>
                        ))}
                    </ul>
                    </FadeInSection>
                  </section>
                );
              case "ambassadors":
                if (isProfile) return null;
                return null;
              case "website":
                if (isProfile || !org?.website) return null;
                return (
                  <section className="py-6 border-t border-border">
                    <FadeInSection>
                      <a href={org.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline">
                      <ExternalLink className="h-4 w-4" />
                      Website
                    </a>
                    </FadeInSection>
                  </section>
                );
              default:
                return null;
            }
          })();
          if (!sectionContent) return null;
            if (isOwner && layoutEditMode) {
              return (
                <div
                  key={sectionId}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`py-6 flex items-start gap-2 border-t border-dashed border-border pt-6 ${dragIndex === index ? "opacity-70" : ""}`}
                >
                <div className="cursor-grab touch-none pt-1 text-muted-foreground" title="Drag to reorder">
                  <GripVertical className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">{sectionContent}</div>
              </div>
            );
          }
          return <div key={sectionId}>{sectionContent}</div>;
        })}

        {/* Last updated */}
        {lastUpdatedRelative && (
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Profile updated {lastUpdatedRelative}
          </p>
        )}

        {/* Viewer CTA: authority footer for non-owners */}
        {!isOwner && (
          <section className="py-10 border-t border-border">
            <div className="text-center">
              <p className="text-sm font-medium text-foreground sm:text-base">
                Create your public reputation profile
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Verified links, proof, and credibility in one page.</p>
              <Link
                href="/login"
                className="mt-4 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Create yours
              </Link>
            </div>
          </section>
        )}

        {/* Brand signature */}
        <p className="pb-6 pt-2 text-center text-xs text-muted-foreground">
          Powered by <span className="font-medium text-primary">Linkary</span>
        </p>
      </main>

      {!isOwner && !brochure && <StickyClaimBar />}
    </div>
  );
}
