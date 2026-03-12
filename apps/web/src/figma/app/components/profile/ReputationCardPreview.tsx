"use client";

import React, { useState, useEffect } from "react";
import { BadgeCheck, Star, Zap, Shield, Crown, Users, Handshake, BarChart3, CircleDot } from "lucide-react";
import QRCode from "qrcode";

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
  /** Only show when real data exists */
  followersCount: number | null;
  /** Only show when real data exists */
  circlesCount: number | null;
  publicProfileUrl: string;
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
  followersCount,
  circlesCount,
}: {
  me: { display_name?: string | null; bio?: string | null; username?: string | null; twitter_username?: string | null; avatar_url?: string | null };
  meStats: { ethos?: number | null; repScore?: number | null; socialPower?: number; completedGigsCount?: number; reviews?: { avg: number; count: number } } | null;
  profileProfessions: { name: string }[];
  caseStudiesCount: number;
  publicSlug: string;
  followersCount?: number | null;
  circlesCount?: number | null;
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
    followersCount: followersCount != null && Number.isFinite(followersCount) ? followersCount : null,
    circlesCount: circlesCount != null && Number.isFinite(circlesCount) ? circlesCount : null,
    publicProfileUrl,
    publicUrlLabel,
  };
}

/** Format large numbers (e.g. 66000 -> 66K) */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

/** Local QR as data URL so export is not tainted by external images */
function useQRDataUrl(url: string | null): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!url) {
      setDataUrl(null);
      return;
    }
    QRCode.toDataURL(url, { width: 200, margin: 1 }).then(setDataUrl).catch(() => setDataUrl(null));
  }, [url]);
  return dataUrl;
}

/** Avatar img that can use optional data URL (for export-safe same-origin) */
function CardAvatar({
  payload,
  avatarDataUrl,
  className,
}: {
  payload: ReputationCardPayload;
  avatarDataUrl: string | null;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const fallbackSrc =
    payload.handle && payload.handle !== "—"
      ? `https://unavatar.io/twitter/${encodeURIComponent(payload.handle)}`
      : null;
  const src = avatarDataUrl ?? payload.avatarUrl ?? fallbackSrc;

  if (errored || !src) {
    return <div className={`shrink-0 rounded-full bg-gradient-to-br from-[#FF5300] to-[#FF5300]/80 ${className}`} aria-hidden />;
  }
  return (
    <img
      src={src}
      alt=""
      className={className}
      onError={() => setErrored(true)}
      crossOrigin={avatarDataUrl ? undefined : "anonymous"}
    />
  );
}

/** Portrait Linkary Reputation Card — SS1 style: premium gradient, branding, 2x2 metrics, compact rows, local QR */
export const ReputationCardPreview = React.forwardRef<
  HTMLDivElement,
  {
    payload: ReputationCardPayload;
    className?: string;
    /** When set, avatar uses this data URL (export-safe); otherwise uses payload.avatarUrl or unavatar */
    avatarDataUrl?: string | null;
  }
>(function ReputationCardPreview({ payload, className = "", avatarDataUrl = null }, ref) {
  const qrDataUrl = useQRDataUrl(payload.publicProfileUrl || null);

  const hasMetrics =
    payload.ethos != null ||
    (payload.power != null && payload.power > 0) ||
    payload.rep != null ||
    payload.tier;
  const hasCompact =
    (payload.followersCount != null && payload.followersCount > 0) ||
    payload.completedGigsCount > 0 ||
    payload.caseStudiesCount > 0 ||
    (payload.circlesCount != null && payload.circlesCount > 0);

  return (
    <div
      ref={ref}
      className={`overflow-hidden rounded-2xl border border-[rgba(19,6,0,0.08)] bg-white text-[#130600] shadow-xl ${className}`}
      style={{
        width: 340,
        minHeight: 560,
        boxShadow: "0 8px 32px rgba(19, 6, 0, 0.08), 0 2px 8px rgba(19, 6, 0, 0.04)",
      }}
    >
      {/* Premium gradient: warm orange to soft cream/white */}
      <div
        className="relative pt-8 pb-6 px-5"
        style={{
          background: "linear-gradient(180deg, #FF5300 0%, #FF8440 28%, #FFB380 55%, #FFF5F0 78%, #FFFFFF 100%)",
        }}
      >
        {/* Subtle texture overlay */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 30%, white 0%, transparent 50%), radial-gradient(circle at 80% 20%, white 0%, transparent 40%)`,
          }}
        />

        {/* Linkary branding: logo (orange bars) + wordmark + tagline */}
        <div className="relative flex flex-col items-center text-center">
          <div className="flex items-center justify-center gap-2">
            <svg className="h-7 w-7 shrink-0" viewBox="0 0 32 32" fill="none" aria-hidden>
              <rect x="4" y="6" width="12" height="2" rx="1" fill="#FF5300" />
              <rect x="4" y="14" width="18" height="2" rx="1" fill="#FF5300" />
              <rect x="4" y="22" width="24" height="2" rx="1" fill="#FF5300" />
            </svg>
            <span className="text-xl font-bold tracking-tight text-[#130600]">Linkary</span>
          </div>
          <p className="text-xs text-[rgba(19,6,0,0.6)] mt-1 font-medium">Verified Signals • Trusted Connections</p>
        </div>

        {/* Large circular avatar with ring/glow */}
        <div className="relative flex justify-center mt-6">
          <div
            className="relative rounded-full p-1"
            style={{
              boxShadow: "0 0 0 3px rgba(255,83,0,0.25), 0 4px 20px rgba(255,83,0,0.15)",
              background: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,200,150,0.4) 100%)",
            }}
          >
            <CardAvatar
              payload={payload}
              avatarDataUrl={avatarDataUrl}
              className="rounded-full object-cover w-24 h-24"
            />
            <div
              className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[#FF5300] p-1"
              aria-hidden
            >
              <BadgeCheck className="h-4 w-4 text-white" strokeWidth={2.5} />
            </div>
          </div>
        </div>

        {/* Display name + headline/roles */}
        <div className="relative text-center mt-4">
          <h2 className="text-xl font-bold text-[#130600] tracking-tight truncate max-w-[280px] mx-auto">
            {payload.displayName}
          </h2>
          {payload.headline && (
            <p className="text-sm text-[rgba(19,6,0,0.65)] mt-0.5 line-clamp-2 px-2">{payload.headline}</p>
          )}
          {payload.roleChips.length > 0 && (
            <p className="text-sm text-[rgba(19,6,0,0.65)] mt-1 font-medium">
              {payload.roleChips.slice(0, 5).join(" • ")}
            </p>
          )}
        </div>
      </div>

      {/* Cream/white body */}
      <div className="px-4 pb-6 pt-2 bg-white">
        {/* 2x2 metric blocks — elevated cards with soft shadow */}
        {hasMetrics && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {payload.ethos != null && (
              <div
                className="rounded-xl border border-[rgba(19,6,0,0.08)] bg-[#FFFBF9] p-3 flex flex-col gap-0.5"
                style={{ boxShadow: "0 2px 8px rgba(19,6,0,0.04)" }}
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-[#FF5300]" strokeWidth={1.75} />
                  <span className="text-xs font-medium text-[rgba(19,6,0,0.6)] uppercase tracking-wide">ETHOS</span>
                </div>
                <span className="text-lg font-bold text-[#130600]">{payload.ethos}</span>
              </div>
            )}
            {(payload.power != null && payload.power > 0) && (
              <div
                className="rounded-xl border border-[rgba(19,6,0,0.08)] bg-[#FFFBF9] p-3 flex flex-col gap-0.5"
                style={{ boxShadow: "0 2px 8px rgba(19,6,0,0.04)" }}
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-[#FF5300]" strokeWidth={1.75} />
                  <span className="text-xs font-medium text-[rgba(19,6,0,0.6)] uppercase tracking-wide">Power</span>
                </div>
                <span className="text-lg font-bold text-[#130600]">{payload.power}</span>
              </div>
            )}
            {payload.rep != null && (
              <div
                className="rounded-xl border border-[rgba(19,6,0,0.08)] bg-[#FFFBF9] p-3 flex flex-col gap-0.5"
                style={{ boxShadow: "0 2px 8px rgba(19,6,0,0.04)" }}
              >
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-[#FF5300]" strokeWidth={1.75} />
                  <span className="text-xs font-medium text-[rgba(19,6,0,0.6)] uppercase tracking-wide">REP</span>
                </div>
                <span className="text-lg font-bold text-[#130600]">{payload.rep}</span>
              </div>
            )}
            {payload.tier && (
              <div
                className="rounded-xl border border-[rgba(19,6,0,0.08)] bg-[#FFFBF9] p-3 flex flex-col gap-0.5"
                style={{ boxShadow: "0 2px 8px rgba(19,6,0,0.04)" }}
              >
                <div className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-[#FF5300]" strokeWidth={1.75} />
                  <span className="text-xs font-medium text-[rgba(19,6,0,0.6)] uppercase tracking-wide">Tier</span>
                </div>
                <span className="text-lg font-bold text-[#130600]">{payload.tier}</span>
              </div>
            )}
          </div>
        )}

        {/* Compact info rows: Followers • Verified Collabs • Case Studies • Circles */}
        {hasCompact && (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
            {payload.followersCount != null && payload.followersCount > 0 && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#FF5300] shrink-0" strokeWidth={1.75} />
                <span className="font-semibold text-[#130600]">{formatCount(payload.followersCount)}</span>
                <span className="text-sm text-[rgba(19,6,0,0.65)]">Followers</span>
              </div>
            )}
            {payload.completedGigsCount > 0 && (
              <div className="flex items-center gap-2">
                <Handshake className="h-4 w-4 text-[#FF5300] shrink-0" strokeWidth={1.75} />
                <span className="font-semibold text-[#130600]">{payload.completedGigsCount}</span>
                <span className="text-sm text-[rgba(19,6,0,0.65)]">Verified Collabs</span>
              </div>
            )}
            {payload.caseStudiesCount > 0 && (
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#FF5300] shrink-0" strokeWidth={1.75} />
                <span className="font-semibold text-[#130600]">{payload.caseStudiesCount}</span>
                <span className="text-sm text-[rgba(19,6,0,0.65)]">Case Studies</span>
              </div>
            )}
            {payload.circlesCount != null && payload.circlesCount > 0 && (
              <div className="flex items-center gap-2">
                <CircleDot className="h-4 w-4 text-[#FF5300] shrink-0" strokeWidth={1.75} />
                <span className="font-semibold text-[#130600]">{payload.circlesCount}</span>
                <span className="text-sm text-[rgba(19,6,0,0.65)]">Circles</span>
              </div>
            )}
          </div>
        )}

        {/* QR section */}
        {qrDataUrl && (
          <div className="flex flex-col items-center pt-2 border-t border-[rgba(19,6,0,0.1)]">
            <img
              src={qrDataUrl}
              alt=""
              className="w-[140px] h-[140px] object-contain rounded-lg bg-white border border-[rgba(19,6,0,0.1)]"
              width={140}
              height={140}
            />
            <p className="text-xs text-[rgba(19,6,0,0.6)] mt-2">Scan to open profile</p>
            {payload.publicUrlLabel && (
              <p className="text-sm font-semibold text-[#130600] mt-0.5 break-all text-center">
                {payload.publicUrlLabel}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
