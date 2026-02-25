"use client";

import React, { useState, useCallback } from "react";
import { isPrivateStorageUrl } from "@/lib/isPrivateStorageUrl";
import { Calendar, Users, UserPlus, MessageCircle, Link2 } from "lucide-react";

export interface ProfileHeaderCardProps {
  displayName: string | null;
  username: string;
  bio: string | null;
  avatarUrl: string | null;
  followers: number | null;
  following: number | null;
  tweets: number | null;
  joinedAt: string | null;
  watchlistButton?: React.ReactNode;
  onWatchlist?: boolean;
  onToggleWatchlist?: () => void;
  /** Use "light" on light page backgrounds (e.g. profile Insights) so text is readable */
  variant?: "light" | "dark";
}

export function ProfileHeaderCard({
  displayName,
  username,
  bio,
  avatarUrl,
  followers,
  following,
  tweets,
  joinedAt,
  watchlistButton,
  onWatchlist,
  onToggleWatchlist,
  variant = "dark",
}: ProfileHeaderCardProps) {
  const [copied, setCopied] = useState(false);
  const isLight = variant === "light";
  const safeAvatar = avatarUrl && !isPrivateStorageUrl(avatarUrl) ? avatarUrl : null;
  const handle = username.replace(/^@/, "").toLowerCase() || "";
  const unavatarFallback = handle ? `https://unavatar.io/twitter/${encodeURIComponent(handle)}` : null;

  const copyProfileLink = useCallback(() => {
    if (!handle) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = `${origin}/${handle}`;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        },
        () => {}
      );
    }
  }, [handle]);

  const formatJoin = (s: string | null) => {
    if (!s) return null;
    try {
      const d = new Date(s);
      return isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    } catch {
      return null;
    }
  };

  const pills = [
    { label: "Followers", value: followers != null ? followers.toLocaleString() : "Data pending", icon: Users },
    { label: "Following", value: following != null ? following.toLocaleString() : "Data pending", icon: UserPlus },
    { label: "Tweets", value: tweets != null ? tweets.toLocaleString() : "Data pending", icon: MessageCircle },
    { label: "Joined", value: formatJoin(joinedAt) ?? "Data pending", icon: Calendar },
  ];

  return (
    <div
      className={
        isLight
          ? "rounded-2xl border border-border bg-card p-6 overflow-hidden shadow-sm"
          : "rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6 overflow-hidden"
      }
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-shrink-0">
          {safeAvatar ? (
            <img
              src={safeAvatar}
              alt=""
              className={`h-20 w-20 rounded-2xl object-cover ${isLight ? "border border-border" : "border border-white/10"}`}
            />
          ) : unavatarFallback ? (
            <img
              src={unavatarFallback}
              alt=""
              className={`h-20 w-20 rounded-2xl object-cover ${isLight ? "border border-border" : "border border-white/10"}`}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className={`h-20 w-20 rounded-2xl ${isLight ? "bg-secondary border border-border" : "bg-white/10 border border-white/10"}`} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1
            className={
              isLight
                ? "text-xl font-semibold text-foreground truncate"
                : "text-xl font-semibold text-white truncate"
            }
          >
            {displayName || `@${handle}`}
          </h1>
          <p className={isLight ? "text-sm font-medium text-foreground" : "text-sm text-white/60"}>
            @{handle}
          </p>
          {bio && (
            <p
              className={
                isLight
                  ? "mt-2 text-sm font-medium text-foreground line-clamp-2"
                  : "mt-2 text-sm text-white/70 line-clamp-2"
              }
            >
              {bio}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {pills.map(({ label, value, icon: Icon }) => (
              <span
                key={label}
                className={
                  isLight
                    ? "inline-flex items-center gap-1.5 rounded-lg bg-secondary border border-border px-2.5 py-1 text-xs font-medium text-foreground"
                    : "inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white/80"
                }
              >
                <Icon className={isLight ? "h-3.5 w-3.5 text-foreground" : "h-3.5 w-3.5 text-white/50"} />
                <span className="font-medium">{value}</span>
                <span className={isLight ? "text-foreground/90" : "text-white/50"}>{label}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          {handle && (
            <button
              type="button"
              onClick={copyProfileLink}
              className={
                isLight
                  ? "rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                  : "rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/15"
              }
            >
              <span className="inline-flex items-center gap-1.5">
                <Link2 className="h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy link"}
              </span>
            </button>
          )}
          {(watchlistButton != null || onToggleWatchlist != null) &&
            (onToggleWatchlist != null ? (
              <button
                type="button"
                onClick={onToggleWatchlist}
                className={
                  isLight
                    ? `rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        onWatchlist
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-border bg-secondary text-foreground hover:bg-accent"
                      }`
                    : `rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        onWatchlist
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-white/20 bg-white/10 text-white/80 hover:bg-white/15"
                      }`
                }
              >
                {onWatchlist ? "On watchlist" : "Watchlist"}
              </button>
            ) : (
              watchlistButton
            ))}
        </div>
      </div>
    </div>
  );
}
