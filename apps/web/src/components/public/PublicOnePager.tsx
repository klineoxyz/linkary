"use client";

import Link from "next/link";
import { BadgeCheck, ExternalLink } from "lucide-react";
import type { PublicEntity } from "@/lib/publicData";
import { PublicHeader } from "./PublicHeader";
import { MetricCard } from "./MetricCard";
import { StickyClaimBar } from "./StickyClaimBar";
import { CaseStudyCard } from "./CaseStudyCard";
import { EcosystemSections } from "./EcosystemSections";
import { DexScreenerEmbed } from "./DexScreenerEmbed";
import { MediaHeader } from "./MediaHeader";

type Props = {
  entity: PublicEntity;
  username: string;
  isLoggedIn: boolean;
};

function SocialsRow({ entity }: { entity: PublicEntity }) {
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
    <div className="flex flex-wrap gap-3">
      {links.map((l) => (
        <a
          key={l.name}
          href={l.url!}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary hover:underline"
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

export function PublicOnePager({ entity, username, isLoggedIn }: Props) {
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader entity={entity} username={username} isLoggedIn={isLoggedIn} />

      <main className="mx-auto max-w-5xl px-4 py-8 pb-24">
        {entity.headerMedia?.header_media_type && entity.headerMedia.header_media_type !== "NONE" && (
          <div className="mb-8">
            <MediaHeader
              type={entity.headerMedia.header_media_type}
              url={entity.headerMedia.header_media_url}
            />
          </div>
        )}

        {/* Hero / Summary */}
        <section className="mb-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-4">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="h-20 w-20 shrink-0 rounded-2xl bg-primary/20" />
                )}
                <div>
                  <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>
                  <p className="text-muted-foreground">@{username}</p>
                  {bio && <p className="mt-2 text-sm text-foreground">{bio}</p>}
                  {profile?.location && (
                    <p className="mt-1 text-xs text-muted-foreground">{profile.location}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="grid w-full grid-cols-3 gap-3 md:w-auto md:min-w-[200px]">
              {isProfile && (
                <>
                  <MetricCard label="ETHOS" value={entity.ethosScore ?? "—"} />
                  <MetricCard label="XScore" value={profile?.xscore ?? "—"} />
                  <MetricCard label="Linkary Power" value={entity.linkaryPower ?? "—"} />
                </>
              )}
              {!isProfile && org && (
                <>
                  <MetricCard label="ETHOS" value={entity.ethosScore ?? org.xscore ?? "—"} />
                  <MetricCard label="XScore" value={org.xscore ?? "—"} />
                  <MetricCard label="Linkary Influence" value={entity.linkaryInfluence ?? "—"} />
                </>
              )}
            </div>
          </div>
        </section>

        {/* Socials */}
        <section className="mb-10">
          <SocialsRow entity={entity} />
        </section>

        {/* Analytics Snapshot (individual) */}
        {isProfile && snap && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Analytics Snapshot (30D)</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard
                label="Average Reach"
                value={snap.reach_avg != null ? Number(snap.reach_avg).toLocaleString() : "—"}
                status={labelForDelta(snap.reach_avg)}
              />
              <MetricCard
                label="Engagement Rate"
                value={
                  snap.engagement_rate != null
                    ? `${(Number(snap.engagement_rate) * 100).toFixed(2)}%`
                    : "—"
                }
                status={labelForDelta(snap.engagement_rate)}
              />
              <MetricCard
                label="Avg Likes/Post"
                value={snap.likes_avg != null ? Number(snap.likes_avg).toLocaleString() : "—"}
              />
              <MetricCard
                label="Avg Replies/Post"
                value={snap.replies_avg != null ? Number(snap.replies_avg).toLocaleString() : "—"}
              />
              <MetricCard
                label="X Spaces Hosted"
                value={snap.spaces_count ?? "—"}
              />
              <MetricCard
                label="Followers Growth"
                value={snap.followers_delta != null ? `${snap.followers_delta > 0 ? "+" : ""}${snap.followers_delta}` : "—"}
                status={labelForDelta(snap.followers_delta)}
              />
            </div>
          </section>
        )}

        {/* Affiliates + Ambassadors (individual) */}
        {isProfile && (entity.affiliate || entity.ambassadors.length > 0) && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Affiliates & Ambassador Programs</h2>
            <div className="flex flex-wrap gap-4">
              {entity.affiliate && (
                <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                  {entity.affiliate.logo_url && (
                    <img
                      src={entity.affiliate.logo_url}
                      alt=""
                      className="h-10 w-10 rounded-lg object-cover"
                    />
                  )}
                  <div>
                    <div className="font-medium text-foreground">{entity.affiliate.org_name}</div>
                    <div className="text-xs text-muted-foreground">
                      Affiliate{entity.affiliate.since_date ? ` since ${entity.affiliate.since_date}` : ""}
                    </div>
                  </div>
                  <BadgeCheck className="h-5 w-5 text-primary" />
                </div>
              )}
              {entity.ambassadors.map((amb) => (
                <div
                  key={amb.org_id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
                >
                  {amb.logo_url && (
                    <img src={amb.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                  )}
                  <div>
                    <div className="font-medium text-foreground">{amb.org_name}</div>
                    <div className="text-xs text-muted-foreground">
                      Ambassador{amb.since_date ? ` since ${amb.since_date}` : ""}
                    </div>
                  </div>
                  <BadgeCheck className="h-5 w-5 text-primary" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Case Studies */}
        {caseStudies.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Case Studies</h2>
            <div className="space-y-4">
              {caseStudies.map((cs) => (
                <CaseStudyCard
                  key={cs.id}
                  title={cs.title}
                  description={cs.description}
                  proofUrl={cs.proof_url}
                  metrics={cs.metrics}
                  createdAt={cs.created_at}
                />
              ))}
            </div>
            {tier === "pro" && entity.caseStudies.length > 3 && (
              <p className="mt-2 text-sm text-muted-foreground">View all on profile.</p>
            )}
          </section>
        )}

        {/* Reviews */}
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold text-foreground">Reviews</h2>
          {avgRating != null && (
            <p className="text-sm text-foreground">
              {avgRating.toFixed(1)} average · {entity.reviews.length} verified reviews
            </p>
          )}
          <div className="mt-4 space-y-3">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-border bg-card p-4"
              >
                <div className="text-sm font-medium text-foreground">
                  {r.rating}/5 {r.title ?? ""}
                </div>
                {r.body && <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>}
              </div>
            ))}
          </div>
        </section>

        {/* Ethos Results (only fields returned) */}
        {entity.ethosResults && Object.keys(entity.ethosResults).length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Ethos Results</h2>
            <ul className="list-inside list-disc space-y-1 text-sm text-foreground">
              {Object.entries(entity.ethosResults).map(([key, value]) => (
                <li key={key}>
                  {key}: {typeof value === "object" ? JSON.stringify(value) : String(value)}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Org: Ecosystem */}
        {!isProfile && entity.ecosystemCategories.length > 0 && (
          <section className="mb-10">
            <EcosystemSections categories={entity.ecosystemCategories} />
          </section>
        )}

        {/* Org: Subsidiaries */}
        {!isProfile && entity.subsidiaries.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-lg font-semibold text-foreground">Subsidiaries</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {entity.subsidiaries.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
                >
                  {sub.logo_url && (
                    <img src={sub.logo_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  )}
                  <div>
                    <div className="font-medium text-foreground">{sub.name}</div>
                    <p className="text-xs text-muted-foreground">@{sub.slug}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Crypto: DexScreener */}
        {!isProfile && org?.is_crypto_project && org?.has_token && entity.dexscreenerUrl && (
          <section className="mb-10">
            <DexScreenerEmbed
              dexscreenerUrl={entity.dexscreenerUrl}
              tokenSymbol={entity.tokenSymbol}
            />
          </section>
        )}

        {/* Org: Website link */}
        {!isProfile && org?.website && (
          <section className="mb-10">
            <a
              href={org.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Website
            </a>
          </section>
        )}
      </main>

      {!isLoggedIn && <StickyClaimBar />}
    </div>
  );
}
