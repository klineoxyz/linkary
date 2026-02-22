"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, ExternalLink, Globe, GripVertical, Save, X } from "lucide-react";
import type { PublicEntity } from "@/lib/publicData";
import type { PublicEntityView } from "@/lib/publicProfileDTO";
import { getProfileSectionOrder, getOrgSectionOrder } from "@/lib/publicLayoutDefaults";
import { PublicHeader } from "./PublicHeader";
import { MetricCard } from "./MetricCard";
import { StickyClaimBar } from "./StickyClaimBar";
import { CaseStudyCard } from "./CaseStudyCard";
import { EcosystemSections } from "./EcosystemSections";
import { DexScreenerEmbed } from "./DexScreenerEmbed";
import { MediaHeader } from "./MediaHeader";
import { supabase } from "@/lib/supabase";

type Props = {
  entity: PublicEntity | PublicEntityView;
  username: string;
  isLoggedIn: boolean;
  isOwner?: boolean;
  analyticsSource?: "worker" | "partial" | "fallback";
  analyticsInitialized?: boolean;
  hasXConnected?: boolean;
};

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
      className="inline-flex items-center justify-center rounded-md p-2 text-foreground hover:bg-accent hover:text-primary min-h-[2.25rem] min-w-[2.25rem]"
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

export function PublicOnePager({ entity, username, isLoggedIn, isOwner = false, analyticsSource, analyticsInitialized, hasXConnected = false }: Props) {
  const router = useRouter();
  const isProfile = entity.type === "profile";
  const profile = entity.profile;
  const org = entity.org;
  const displayName = isProfile ? profile?.display_name ?? username : org?.name ?? username;
  const bio = isProfile ? profile?.bio : org?.tagline;
  const avatarUrl = isProfile ? profile?.avatar_url : org?.logo_url;
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
    <div className="min-h-screen bg-background text-foreground font-sans">
      <PublicHeader entity={entity} username={username} isLoggedIn={isLoggedIn} isOwner={isOwner} />

      <main className="mx-auto max-w-5xl px-4 py-6 pb-20">
        {isOwner && (
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

        {entity.headerMedia?.header_media_type && entity.headerMedia.header_media_type !== "NONE" && (
          <div className="mb-8">
            <MediaHeader
              type={entity.headerMedia.header_media_type}
              url={entity.headerMedia.header_media_url}
            />
          </div>
        )}

        {/* Profile: hero then socials and highlights under it */}
        <section className="pt-2 pb-4">
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
              <p className="text-sm text-muted-foreground">@{username}</p>
              {bio && <p className="mt-2 text-sm text-muted-foreground">{bio}</p>}
              {profile?.location && (
                <p className="mt-1 text-xs text-muted-foreground">{profile.location}</p>
              )}
            </div>
          </div>

          {/* Socials under profile */}
          {(hasSocials || orgWebsite || orgTwitter) && (
            <nav className="mt-6 flex flex-wrap items-center gap-2 sm:gap-3" aria-label="Social links">
              {hasSocials && <SocialsRow entity={entity} />}
              {orgWebsite && (
                <a
                  href={orgWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-primary"
                >
                  Website
                </a>
              )}
              {orgTwitter && (
                <a
                  href={`https://x.com/${orgTwitter.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-primary"
                >
                  X
                </a>
              )}
            </nav>
          )}

          {/* Highlights under profile: ETHOS, XScore, Linkary */}
          <div className="mt-6 flex flex-wrap items-baseline gap-6 sm:gap-8 border-b border-border pb-6" aria-label="Highlights">
            {isProfile && (
              <>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ETHOS</div>
                  <div className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{entity.ethosScore ?? "—"}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">XScore</div>
                  <div className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{profile?.xscore ?? "—"}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Linkary</div>
                  <div className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{entity.linkaryPower ?? "—"}</div>
                </div>
              </>
            )}
            {!isProfile && org && (
              <>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">XScore</div>
                  <div className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{org.xscore ?? "—"}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Linkary</div>
                  <div className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{entity.linkaryInfluence ?? "—"}</div>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Reorderable sections (order from public_layout or default) */}
        {orderedSectionIds.map((sectionId, index) => {
          if (hiddenSet.has(sectionId)) return null;
          const sectionContent = (() => {
            switch (sectionId) {
              case "socials":
                return null;
              case "analytics":
                if (!isProfile) return null;
                if (!hasXConnected) {
                  return (
                    <section className="py-6 border-t border-border">
                      <p className="text-sm text-muted-foreground">Connect X to enable analytics</p>
                    </section>
                  );
                }
                if (!snap && !analyticsInitialized) {
                  return (
                    <section className="py-6 border-t border-border">
                      <h2 className="mb-4 text-lg font-semibold text-foreground">30d Activity</h2>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <div key={i} className="rounded-md bg-muted/40 p-4 animate-pulse">
                            <div className="h-4 w-16 rounded bg-muted" />
                            <div className="mt-2 h-8 w-20 rounded bg-muted" />
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                }
                const showPartialBanner = hasXConnected && (analyticsSource === "partial" || analyticsSource === "fallback");
                return (
                  <section className="py-6 border-t border-border">
                    {showPartialBanner && (
                      <p className="mb-4 text-sm text-muted-foreground">
                        90-day history is building. Activity history is real; follower growth tracked since connection.
                      </p>
                    )}
                    <h2 className="mb-4 text-lg font-semibold text-foreground">30d Activity</h2>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <MetricCard label="Average Reach" value={snap?.reach_avg != null ? Number(snap.reach_avg).toLocaleString() : "—"} status={snap ? labelForDelta(snap.reach_avg) : null} />
                      <MetricCard label="Engagement Rate" value={snap?.engagement_rate != null ? `${(Number(snap.engagement_rate) * 100).toFixed(2)}%` : "—"} status={snap ? labelForDelta(snap.engagement_rate) : null} />
                      <MetricCard label="Avg Likes/Post" value={snap?.likes_avg != null ? Number(snap.likes_avg).toLocaleString() : "—"} />
                      <MetricCard label="Avg Replies/Post" value={snap?.replies_avg != null ? Number(snap.replies_avg).toLocaleString() : "—"} />
                      <MetricCard label="X Spaces Hosted" value={snap?.spaces_count ?? "—"} />
                      <MetricCard label="Followers Growth" value={snap?.followers_delta != null ? `${snap.followers_delta > 0 ? "+" : ""}${snap.followers_delta}` : "—"} status={snap ? labelForDelta(snap.followers_delta) : null} />
                    </div>
                  </section>
                );
              case "affiliates":
                if (isProfile && (entity.affiliate || entity.ambassadors.length > 0)) {
                  return (
                    <section className="py-6 border-t border-border">
                      <h2 className="mb-2 text-lg font-semibold text-foreground">Partners & programs</h2>
                      <p className="mb-4 text-sm text-muted-foreground">Affiliates and ambassador programs</p>
                      <ul className="space-y-3">
                        {entity.affiliate && (
                          <li className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                            {entity.affiliate.logo_url && <img src={entity.affiliate.logo_url} alt="" className="h-10 w-10 rounded-md object-cover" />}
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-foreground">{entity.affiliate.org_name}</div>
                              <div className="text-xs text-muted-foreground">Affiliate{entity.affiliate.since_date ? ` since ${entity.affiliate.since_date}` : ""}</div>
                            </div>
                            <BadgeCheck className="h-5 w-5 shrink-0 text-primary" />
                          </li>
                        )}
                        {entity.ambassadors.map((amb) => (
                          <li key={amb.org_id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                            {amb.logo_url && <img src={amb.logo_url} alt="" className="h-10 w-10 rounded-md object-cover" />}
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-foreground">{amb.org_name}</div>
                              <div className="text-xs text-muted-foreground">Ambassador{amb.since_date ? ` since ${amb.since_date}` : ""}</div>
                            </div>
                            <BadgeCheck className="h-5 w-5 shrink-0 text-primary" />
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                }
                if (!isProfile && (entity.affiliate || entity.ambassadors.length > 0)) return null;
                return null;
              case "caseStudies":
                if (caseStudies.length === 0) return null;
                return (
                  <section className="py-6 border-t border-border">
                    <h2 className="mb-2 text-lg font-semibold text-foreground">Case Studies</h2>
                    <p className="mb-4 text-sm text-muted-foreground">Proof and results</p>
                    <div className="space-y-3">
                      {caseStudies.map((cs) => (
                        <CaseStudyCard key={cs.id} title={cs.title} description={cs.description} proofUrl={cs.proof_url} metrics={cs.metrics} createdAt={cs.created_at} />
                      ))}
                    </div>
                    {tier === "pro" && entity.caseStudies.length > 3 && <p className="mt-2 text-sm text-muted-foreground">View all on profile.</p>}
                  </section>
                );
              case "reviews":
                return (
                  <section className="py-6 border-t border-border">
                    <h2 className="mb-2 text-lg font-semibold text-foreground">Reviews</h2>
                    {avgRating != null && <p className="mb-4 text-sm text-muted-foreground">{avgRating.toFixed(1)} average · {entity.reviews.length} verified reviews</p>}
                    <ul className="space-y-0">
                      {reviews.map((r) => (
                        <li key={r.id} className="py-3 border-b border-border/50 last:border-0">
                          <div className="text-sm font-medium text-foreground">{r.rating}/5 {r.title ?? ""}</div>
                          {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              case "ethos":
                if (!entity.ethosResults || Object.keys(entity.ethosResults).length === 0) return null;
                return (
                  <section className="py-6 border-t border-border">
                    <h2 className="mb-4 text-lg font-semibold text-foreground">Ethos Results</h2>
                    <ul className="list-inside list-disc space-y-1 text-sm text-foreground">
                      {Object.entries(entity.ethosResults).map(([key, value]) => (
                        <li key={key}>{key}: {typeof value === "object" ? JSON.stringify(value) : String(value)}</li>
                      ))}
                    </ul>
                  </section>
                );
              case "about":
                if (isProfile) return null;
                if (!bio && !org?.website) return null;
                return (
                  <section className="py-6 border-t border-border">
                    <h2 className="mb-4 text-lg font-semibold text-foreground">About</h2>
                    {bio && <p className="text-foreground">{bio}</p>}
                  </section>
                );
              case "ecosystem":
                if (isProfile || entity.ecosystemCategories.length === 0) return null;
                return (
                  <section className="py-6 border-t border-border">
                    <EcosystemSections categories={entity.ecosystemCategories} />
                  </section>
                );
              case "token":
                if (isProfile || !org?.is_crypto_project || !org?.has_token || !entity.dexscreenerUrl) return null;
                return (
                  <section className="py-6 border-t border-border">
                    <DexScreenerEmbed dexscreenerUrl={entity.dexscreenerUrl} tokenSymbol={entity.tokenSymbol} />
                  </section>
                );
              case "subsidiaries":
                if (isProfile || entity.subsidiaries.length === 0) return null;
                return (
                  <section className="py-6 border-t border-border">
                    <h2 className="mb-4 text-lg font-semibold text-foreground">Subsidiaries</h2>
                    <ul className="space-y-0">
                      {entity.subsidiaries.map((sub) => (
                        <li key={sub.id} className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0">
                          {sub.logo_url && <img src={sub.logo_url} alt="" className="h-12 w-12 rounded-md object-cover" />}
                          <div>
                            <div className="font-medium text-foreground">{sub.name}</div>
                            <p className="text-xs text-muted-foreground">@{sub.slug}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              case "ambassadors":
                if (isProfile) return null;
                return null;
              case "website":
                if (isProfile || !org?.website) return null;
                return (
                  <section className="py-6 border-t border-border">
                    <a href={org.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-primary hover:underline">
                      <ExternalLink className="h-4 w-4" />
                      Website
                    </a>
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

        {/* Viewer CTA: soft block at bottom for non-owners */}
        {!isOwner && (
          <section className="py-10 border-t border-border">
            <div className="text-center">
              <p className="text-sm font-medium text-foreground sm:text-base">
                Create your verified link-in-bio on Linkary
              </p>
              <Link
                href="/login"
                className="mt-4 inline-block rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Create yours
              </Link>
            </div>
          </section>
        )}
      </main>

      {!isOwner && <StickyClaimBar />}
    </div>
  );
}
