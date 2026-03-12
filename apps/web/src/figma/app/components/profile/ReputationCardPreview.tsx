"use client";

import React from "react";
import { ProfileAvatar } from "../SharedComponents";
import { BadgeCheck, Briefcase, Star, Zap, Shield, TrendingUp } from "lucide-react";

/** View model for the reputation card — profile snapshot only, no mock data */
export type ReputationCardPayload = {
  displayName: string;
  handle: string;
  headline: string;
  roleChips: string[];
  avatarUrl: string | null;
  ethos: number | null;
  power: number | null;
  rep: number | null;
  tier: string | null;
  completedGigsCount: number;
  caseStudiesCount: number;
  reviewsAvg: number;
  reviewsCount: number;
  /** Canonical public profile URL for QR and label */
  publicProfileUrl: string;
  /** Public URL display label (e.g. linkary.xyz/username) */
  publicUrlLabel: string;
};

function repTierLabel(rep: number): string {
  if (rep <= 19) return "Starter";
  if (rep <= 39) return "Rising";
  if (rep <= 59) return "Verified";
  if (rep <= 79) return "Elite";
  return "Legendary";
}

export function buildReputationCardPayload({
  me,
  meStats,
  profileProfessions,
  caseStudiesCount,
  publicSlug,
}: {
  me: { display_name?: string | null; bio?: string | null; username?: string | null; twitter_username?: string | null; avatar_url?: string | null };
  meStats: { ethos?: number | null; repScore?: number | null; socialPower?: number; completedGigsCount?: number; reviews?: { avg: number; count: number } } | null;
  profileProfessions: { name: string }[];
  caseStudiesCount: number;
  publicSlug: string;
}): ReputationCardPayload {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicProfileUrl = publicSlug ? `${origin}/${encodeURIComponent(publicSlug)}` : "";
  const publicUrlLabel = publicSlug ? `${origin.replace(/^https?:\/\//, "").split("/")[0] || "linkary.xyz"}/${publicSlug}` : "";
  const handle = (me?.username ?? me?.twitter_username ?? "").replace(/^@/, "").trim();
  const headline = (me?.bio ?? "").trim().split("\n")[0].slice(0, 80) || "";
  const roleChips = (profileProfessions ?? []).map((p) => p.name);
  const rep = meStats?.repScore != null && Number.isFinite(Number(meStats.repScore)) ? Number(meStats.repScore) : null;
  const tier = rep != null ? repTierLabel(rep) : null;

  return {
    displayName: (me?.display_name ?? "").trim() || "—",
    handle: handle || "—",
    headline,
    roleChips,
    avatarUrl: me?.avatar_url?.trim() || null,
    ethos: meStats?.ethos != null && Number.isFinite(Number(meStats.ethos)) ? Number(meStats.ethos) : null,
    power: meStats?.socialPower != null && Number.isFinite(meStats.socialPower) ? meStats.socialPower : null,
    rep,
    tier,
    completedGigsCount: typeof meStats?.completedGigsCount === "number" ? meStats.completedGigsCount : 0,
    caseStudiesCount,
    reviewsAvg: meStats?.reviews?.avg ?? 0,
    reviewsCount: meStats?.reviews?.count ?? 0,
    publicProfileUrl,
    publicUrlLabel,
  };
}

const QR_SIZE = 160;
function qrImageUrl(data: string): string {
  if (!data) return "";
  return `https://api.qrserver.com/v1/create-qr-code/?size=${QR_SIZE}x${QR_SIZE}&data=${encodeURIComponent(data)}`;
}

/** Portrait Linkary Reputation Card — light theme, design tokens only */
export const ReputationCardPreview = React.forwardRef<
  HTMLDivElement,
  { payload: ReputationCardPayload; className?: string }
>(function ReputationCardPreview({ payload, className = "" }, ref) {
  const qrUrl = payload.publicProfileUrl ? qrImageUrl(payload.publicProfileUrl) : null;

  return (
    <div
      ref={ref}
      className={`rounded-xl border border-border bg-card text-card-foreground overflow-hidden shadow-lg ${className}`}
      style={{ width: 320, minHeight: 480 }}
    >
      {/* Top brand bar */}
      <div className="bg-primary px-4 py-2 flex items-center gap-2">
        <img src="/icons/icon-white.svg" alt="" className="h-6 w-6" aria-hidden />
        <span className="text-sm font-medium text-primary-foreground">Linkary Reputation</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Avatar + name + headline */}
        <div className="flex flex-col items-center text-center">
          <ProfileAvatar
            handle={payload.handle}
            alt={payload.displayName}
            avatarUrl={payload.avatarUrl}
            className="h-20 w-20 rounded-xl object-cover shrink-0 border-2 border-border"
            fallbackGradient="from-primary to-primary/80"
          />
          <div className="mt-3 flex items-center justify-center gap-1.5">
            <span className="text-lg font-semibold text-foreground truncate max-w-[240px]">{payload.displayName}</span>
            <BadgeCheck className="h-4 w-4 text-primary shrink-0" strokeWidth={1.75} />
          </div>
          {payload.headline && (
            <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{payload.headline}</p>
          )}
          {payload.roleChips.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 mt-2">
              {payload.roleChips.slice(0, 5).map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center rounded-md border border-border bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Metrics grid — only show blocks that have data */}
        <div className="grid grid-cols-2 gap-2">
          {payload.ethos != null && (
            <div className="rounded-lg border border-border bg-secondary/50 px-3 py-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" strokeWidth={1.75} />
              <div>
                <p className="text-xs text-muted-foreground">ETHOS</p>
                <p className="text-sm font-semibold text-foreground">{payload.ethos}</p>
              </div>
            </div>
          )}
          {payload.power != null && payload.power > 0 && (
            <div className="rounded-lg border border-border bg-secondary/50 px-3 py-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" strokeWidth={1.75} />
              <div>
                <p className="text-xs text-muted-foreground">Power</p>
                <p className="text-sm font-semibold text-foreground">{payload.power}</p>
              </div>
            </div>
          )}
          {payload.rep != null && (
            <div className="rounded-lg border border-border bg-secondary/50 px-3 py-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" strokeWidth={1.75} />
              <div>
                <p className="text-xs text-muted-foreground">REP</p>
                <p className="text-sm font-semibold text-foreground">{payload.rep}</p>
              </div>
            </div>
          )}
          {payload.tier && (
            <div className="rounded-lg border border-border bg-secondary/50 px-3 py-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Tier</span>
              <p className="text-sm font-semibold text-foreground">{payload.tier}</p>
            </div>
          )}
        </div>

        {/* Reviews */}
        {(payload.reviewsCount > 0 || payload.completedGigsCount > 0 || payload.caseStudiesCount > 0) && (
          <div className="flex flex-wrap gap-3 text-sm">
            {payload.reviewsCount > 0 && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Star className="h-4 w-4 text-primary" strokeWidth={1.75} />
                {payload.reviewsAvg} ({payload.reviewsCount})
              </span>
            )}
            {payload.completedGigsCount > 0 && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Briefcase className="h-4 w-4 text-primary" strokeWidth={1.75} />
                {payload.completedGigsCount} verified
              </span>
            )}
            {payload.caseStudiesCount > 0 && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                {payload.caseStudiesCount} case studies
              </span>
            )}
          </div>
        )}

        {/* QR + public URL */}
        {qrUrl && payload.publicUrlLabel && (
          <div className="flex flex-col items-center pt-2 border-t border-border">
            <img src={qrUrl} alt="" className="w-[120px] h-[120px] object-contain bg-white rounded-lg border border-border" width={120} height={120} />
            <p className="text-xs text-muted-foreground mt-2 text-center break-all">{payload.publicUrlLabel}</p>
          </div>
        )}
      </div>
    </div>
  );
});
