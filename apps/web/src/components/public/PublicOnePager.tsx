"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, ExternalLink, GripVertical, Save, X } from "lucide-react";
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

function SocialsRow({ entity }: { entity: PublicEntityView | PublicEntity }) {
  const socials = entity.socials;
  if (!socials) return null;
  const links: { name: string; url: string | null }[] = [
    { name: "X", url: socials.x_url },
    { name: "LinkedIn", url: socials.linkedin_url },
    { name: "YouTube", url: socials.youtube_url },
    { name: "Website", url: socials.website_url },
    { name: "Telegram", url: socials.telegram_url },
  ].filter((l) => l.url);
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
      {links.map((l) => (
        <a
          key={l.name}
          href={l.url!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-primary min-h-[2.5rem]"
        >
          {l.name}
        </a>
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
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader entity={entity} username={username} isLoggedIn={isLoggedIn} isOwner={isOwner} />

      <main className="mx-auto max-w-5xl px-4 py-8 pb-24">
        {isOwner && (
          <div className="mb-6 flex items-center gap-2">
            {!layoutEditMode ? (
              <button
                type="button"
                onClick={() => {
                  setLayoutEditMode(true);
                  setLocalOrder(displayOrder);
                }}
                className="rounded-lg border border-border bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80"
              >
                Edit Layout
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSaveLayout}
                  disabled={savingLayout}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {savingLayout ? "Saving…" : "Save order"}
                </button>
                <button
                  type="button"
                  onClick={() => { setLayoutEditMode(false); setLocalOrder(displayOrder); }}
                  className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
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
        <section className="py-8">
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
                  className="inline-flex items-center rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-primary"
                >
                  Website
                </a>
              )}
              {orgTwitter && (
                <a
                  href={`https://x.com/${orgTwitter.replace(/^@/, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-primary"
                >
                  X
                </a>
              )}
            </nav>
          )}

          {/* Highlights under profile: ETHOS, XScore, Linkary */}
          <div className="mt-6 flex flex-wrap gap-3 sm:gap-4" aria-label="Highlights">
            {isProfile && (
              <>
                <div className="min-w-0 rounded-xl border border-border bg-muted/30 px-4 py-3 sm:px-5 sm:py-4">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">ETHOS</div>
                  <div className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{entity.ethosScore ?? "—"}</div>
                </div>
                <div className="min-w-0 rounded-xl border border-border bg-muted/30 px-4 py-3 sm:px-5 sm:py-4">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">XScore</div>
                  <div className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{profile?.xscore ?? "—"}</div>
                </div>
                <div className="min-w-0 rounded-xl border border-border bg-muted/30 px-4 py-3 sm:px-5 sm:py-4">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Linkary</div>
                  <div className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{entity.linkaryPower ?? "—"}</div>
                </div>
              </>
            )}
            {!isProfile && org && (
              <>
                <div className="min-w-0 rounded-xl border border-border bg-muted/30 px-4 py-3 sm:px-5 sm:py-4">
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">XScore</div>
                  <div className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">{org.xscore ?? "—"}</div>
                </div>
                <div className="min-w-0 rounded-xl border border-border bg-muted/30 px-4 py-3 sm:px-5 sm:py-4">
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
                    <section className="py-8">
                      <div className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                        Connect X to enable analytics
                      </div>
                    </section>
                  );
                }
                if (!snap && !analyticsInitialized) {
                  return (
                    <section className="py-8">
                      <h2 className="mb-4 text-lg font-semibold text-foreground">30d Activity</h2>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <div key={i} className="rounded-xl border border-border bg-muted/30 p-4 animate-pulse">
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
                  <section className="py-8">
                    {showPartialBanner && (
                      <div className="mb-4 rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                        90-day history is building. Activity history is real; follower growth tracked since connection.
                      </div>
                    )}
                    <h2 className="mb-4 text-lg font-semibold text-foreground">30d Activity</h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    <section className="py-8">
                      <h2 className="mb-2 text-lg font-semibold text-foreground">Partners & programs</h2>
                      <p className="mb-4 text-sm text-muted-foreground">Affiliates and ambassador programs</p>
                      <div className="flex flex-wrap gap-4">
                        {entity.affiliate && (
                          <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
                            {entity.affiliate.logo_url && <img src={entity.affiliate.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />}
                            <div>
                              <div className="font-medium text-foreground">{entity.affiliate.org_name}</div>
                              <div className="text-xs text-muted-foreground">Affiliate{entity.affiliate.since_date ? ` since ${entity.affiliate.since_date}` : ""}</div>
                            </div>
                            <BadgeCheck className="h-5 w-5 shrink-0 text-primary" />
                          </div>
                        )}
                        {entity.ambassadors.map((amb) => (
                          <div key={amb.org_id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
                            {amb.logo_url && <img src={amb.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />}
                            <div>
                              <div className="font-medium text-foreground">{amb.org_name}</div>
                              <div className="text-xs text-muted-foreground">Ambassador{amb.since_date ? ` since ${amb.since_date}` : ""}</div>
                            </div>
                            <BadgeCheck className="h-5 w-5 shrink-0 text-primary" />
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                }
                if (!isProfile && (entity.affiliate || entity.ambassadors.length > 0)) return null;
                return null;
              case "caseStudies":
                if (caseStudies.length === 0) return null;
                return (
                  <section className="py-8">
                    <h2 className="mb-2 text-lg font-semibold text-foreground">Case Studies</h2>
                    <p className="mb-4 text-sm text-muted-foreground">Proof and results</p>
                    <div className="space-y-4">
                      {caseStudies.map((cs) => (
                        <CaseStudyCard key={cs.id} title={cs.title} description={cs.description} proofUrl={cs.proof_url} metrics={cs.metrics} createdAt={cs.created_at} />
                      ))}
                    </div>
                    {tier === "pro" && entity.caseStudies.length > 3 && <p className="mt-2 text-sm text-muted-foreground">View all on profile.</p>}
                  </section>
                );
              case "reviews":
                return (
                  <section className="py-8">
                    <h2 className="mb-4 text-lg font-semibold text-foreground">Reviews</h2>
                    {avgRating != null && <p className="text-sm text-foreground">{avgRating.toFixed(1)} average · {entity.reviews.length} verified reviews</p>}
                      <div className="mt-4 space-y-3">
                      {reviews.map((r) => (
                        <div key={r.id} className="rounded-xl border border-border bg-muted/30 p-4">
                          <div className="text-sm font-medium text-foreground">{r.rating}/5 {r.title ?? ""}</div>
                          {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
                        </div>
                      ))}
                    </div>
                  </section>
                );
              case "ethos":
                if (!entity.ethosResults || Object.keys(entity.ethosResults).length === 0) return null;
                return (
                  <section className="py-8">
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
                  <section className="py-8">
                    <h2 className="mb-4 text-lg font-semibold text-foreground">About</h2>
                    {bio && <p className="text-foreground">{bio}</p>}
                  </section>
                );
              case "ecosystem":
                if (isProfile || entity.ecosystemCategories.length === 0) return null;
                return (
                  <section className="py-8">
                    <EcosystemSections categories={entity.ecosystemCategories} />
                  </section>
                );
              case "token":
                if (isProfile || !org?.is_crypto_project || !org?.has_token || !entity.dexscreenerUrl) return null;
                return (
                  <section className="py-8">
                    <DexScreenerEmbed dexscreenerUrl={entity.dexscreenerUrl} tokenSymbol={entity.tokenSymbol} />
                  </section>
                );
              case "subsidiaries":
                if (isProfile || entity.subsidiaries.length === 0) return null;
                return (
                  <section className="py-8">
                    <h2 className="mb-4 text-lg font-semibold text-foreground">Subsidiaries</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {entity.subsidiaries.map((sub) => (
                        <div key={sub.id} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-4">
                          {sub.logo_url && <img src={sub.logo_url} alt="" className="h-12 w-12 rounded-lg object-cover" />}
                          <div>
                            <div className="font-medium text-foreground">{sub.name}</div>
                            <p className="text-xs text-muted-foreground">@{sub.slug}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              case "ambassadors":
                if (isProfile) return null;
                return null;
              case "website":
                if (isProfile || !org?.website) return null;
                return (
                  <section className="py-8">
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
                className={`py-8 flex items-start gap-2 rounded-lg border border-dashed border-border p-2 ${dragIndex === index ? "opacity-70" : ""}`}
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
          <section className="py-12">
            <div className="rounded-2xl border border-border bg-muted/30 px-6 py-8 text-center sm:px-8">
              <p className="text-sm font-medium text-foreground sm:text-base">
                Create your verified link-in-bio on Linkary
              </p>
              <Link
                href="/login"
                className="mt-4 inline-block rounded-lg border border-primary/50 bg-primary/10 px-5 py-2.5 text-sm font-medium text-primary hover:bg-primary/20"
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
