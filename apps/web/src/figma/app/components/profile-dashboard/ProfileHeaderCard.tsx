"use client";

import React from "react";
import { isPrivateStorageUrl } from "@/lib/isPrivateStorageUrl";
import { Calendar, Users, UserPlus, MessageCircle } from "lucide-react";

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
}: ProfileHeaderCardProps) {
  const safeAvatar = avatarUrl && !isPrivateStorageUrl(avatarUrl) ? avatarUrl : null;
  const handle = username.replace(/^@/, "");
  const unavatarFallback = handle ? `https://unavatar.io/twitter/${encodeURIComponent(handle)}` : null;

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
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6 overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="flex-shrink-0">
          {safeAvatar ? (
            <img
              src={safeAvatar}
              alt=""
              className="h-20 w-20 rounded-2xl object-cover border border-white/10"
            />
          ) : unavatarFallback ? (
            <img
              src={unavatarFallback}
              alt=""
              className="h-20 w-20 rounded-2xl object-cover border border-white/10"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="h-20 w-20 rounded-2xl bg-white/10 border border-white/10" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-white truncate">{displayName || `@${handle}`}</h1>
          <p className="text-sm text-white/60">@{handle}</p>
          {bio && <p className="mt-2 text-sm text-white/70 line-clamp-2">{bio}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {pills.map(({ label, value, icon: Icon }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-xs text-white/80"
              >
                <Icon className="h-3.5 w-3.5 text-white/50" />
                <span className="font-medium">{value}</span>
                <span className="text-white/50">{label}</span>
              </span>
            ))}
          </div>
        </div>
        {(watchlistButton != null || onToggleWatchlist != null) && (
          <div className="flex-shrink-0">
            {onToggleWatchlist != null ? (
              <button
                type="button"
                onClick={onToggleWatchlist}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  onWatchlist
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-white/20 bg-white/10 text-white/80 hover:bg-white/15"
                }`}
              >
                {onWatchlist ? "On watchlist" : "Watchlist"}
              </button>
            ) : (
              watchlistButton
            )}
          </div>
        )}
      </div>
    </div>
  );
}
