"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart2, ExternalLink, Lock, AlertCircle, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PRICING_PATH, upgradeCtaLine } from "@/lib/planPackageUi";
import {
  CROSS_USER_ANALYTICS_EMPTY_BODY,
  CROSS_USER_ANALYTICS_EMPTY_TITLE,
} from "@/lib/analytics-owner-state-presentation";
import { formatTryAgainAfter } from "@/lib/rateLimitUx";

type Profile = { username: string; display_name: string | null; avatar_url: string | null };
type Analytics = {
  posts_7d?: number | null;
  posts_30d: number | null;
  posts_90d?: number | null;
  avg_likes_30d: number | null;
  avg_replies_30d: number | null;
  engagement_rate_30d: number | null;
  reach_proxy_30d: number | null;
};

type Status = "idle" | "loading" | "success" | "locked" | "unauthorized" | "rate_limited" | "not_found" | "error";

export default function CrossUserAnalyticsPage({
  username: usernameProp,
  setRoute,
}: {
  username: string;
  setRoute?: (r: { name: string }) => void;
}) {
  const router = useRouter();
  const username = (usernameProp ?? "").trim().replace(/^@/, "");
  const [status, setStatus] = useState<Status>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rateLimitResetAt, setRateLimitResetAt] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!username) {
      setStatus("error");
      setErrorMessage("Username required");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setStatus("unauthorized");
      return;
    }
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setStatus("loading");
    setErrorMessage(null);
    const res = await fetch(`${base}/api/me/analytics/profile/${encodeURIComponent(username)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));

    if (res.status === 401) {
      setStatus("unauthorized");
      return;
    }
    if (res.status === 403 && (json?.code === "ANALYTICS_VIEW_NOT_ELIGIBLE" || json?.code === "DISCOVERY_NOT_ELIGIBLE")) {
      setStatus("locked");
      return;
    }
    if (res.status === 429 || json?.code === "RATE_LIMITED") {
      setRateLimitResetAt(typeof json?.resetAt === "string" ? json.resetAt : null);
      setStatus("rate_limited");
      return;
    }
    if (res.status === 404 || json?.code === "NOT_FOUND") {
      setStatus("not_found");
      return;
    }
    if (!res.ok) {
      setStatus("error");
      setErrorMessage(json?.message ?? "Something went wrong");
      return;
    }
    setStatus("success");
    setProfile(json?.profile ?? null);
    setAnalytics(json?.analytics ?? null);
  }, [username]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const goToPublicProfile = () => {
    if (!username) return;
    const slug = String(username).replace(/^@/, "");
    router.push(`/${encodeURIComponent(slug)}`);
  };

  if (!username) {
    return (
      <div className="max-w-2xl mx-auto p-6" data-page="cross-user-analytics">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Username is required.</p>
        </div>
      </div>
    );
  }

  if (status === "unauthorized") {
    return (
      <div className="max-w-2xl mx-auto p-6" data-page="cross-user-analytics">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium text-foreground">Sign in required</h2>
          <p className="text-sm text-muted-foreground mt-2">Please sign in to view analytics.</p>
          {setRoute && (
            <button
              type="button"
              onClick={() => setRoute({ name: "login" })}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === "locked") {
    return (
      <div className="max-w-2xl mx-auto p-6" data-page="cross-user-analytics">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium text-foreground">Other profiles&apos; analytics</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{upgradeCtaLine("cross_user_analytics")}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link
              href={PRICING_PATH}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              View packs
            </Link>
            {setRoute && (
              <button
                type="button"
                onClick={() => setRoute({ name: "analytics" })}
                className="inline-flex items-center justify-center rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground"
              >
                Back to Analytics
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (status === "rate_limited") {
    return (
      <div className="max-w-2xl mx-auto p-6" data-page="cross-user-analytics">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h2 className="text-lg font-medium text-foreground">Too many requests</h2>
          <p className="text-sm text-muted-foreground mt-2">{formatTryAgainAfter(rateLimitResetAt)}</p>
          {setRoute && (
            <button
              type="button"
              onClick={() => setRoute({ name: "analytics" })}
              className="mt-4 inline-flex items-center justify-center rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground"
            >
              Back to Analytics
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === "not_found") {
    return (
      <div className="max-w-2xl mx-auto p-6" data-page="cross-user-analytics">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium text-foreground">Profile not found</h2>
          <p className="text-sm text-muted-foreground mt-2">@{username} could not be found or is not published.</p>
          {setRoute && (
            <button
              type="button"
              onClick={() => setRoute({ name: "analytics" })}
              className="mt-4 inline-flex items-center justify-center rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground"
            >
              Back to Analytics
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="max-w-2xl mx-auto p-6" data-page="cross-user-analytics">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-lg font-medium text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mt-2">{errorMessage ?? "Please try again."}</p>
          <button
            type="button"
            onClick={fetchData}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6" data-page="cross-user-analytics">
        <div className="rounded-xl border border-border bg-card p-6 animate-pulse">
          <div className="flex gap-3">
            <div className="h-12 w-12 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-32 bg-muted rounded" />
              <div className="h-4 w-24 bg-muted rounded" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 animate-pulse space-y-4">
          <div className="h-4 w-48 bg-muted rounded" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6" data-page="cross-user-analytics">
      <header className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-12 w-12 rounded-full bg-muted shrink-0 flex items-center justify-center">
                <BarChart2 className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-foreground truncate">
                {profile?.display_name || profile?.username || `@${username}`}
              </h1>
              <p className="text-sm text-muted-foreground truncate">@{profile?.username ?? username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={goToPublicProfile}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              <ExternalLink className="h-4 w-4" /> View public profile
            </button>
            {setRoute && (
              <button
                type="button"
                onClick={() => setRoute({ name: "analytics" })}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Back to my Analytics
              </button>
            )}
          </div>
        </div>
      </header>

      {analytics ? (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">X analytics snapshot</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {analytics.posts_7d != null && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">Posts (7d)</p>
                <p className="text-lg font-semibold text-foreground tabular-nums">{Number(analytics.posts_7d)}</p>
              </div>
            )}
            {analytics.posts_30d != null && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">Posts (30d)</p>
                <p className="text-lg font-semibold text-foreground tabular-nums">{Number(analytics.posts_30d)}</p>
              </div>
            )}
            {analytics.posts_90d != null && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">Posts (90d)</p>
                <p className="text-lg font-semibold text-foreground tabular-nums">{Number(analytics.posts_90d)}</p>
              </div>
            )}
            {analytics.engagement_rate_30d != null && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">Engagement rate (30d)</p>
                <p className="text-lg font-semibold text-foreground tabular-nums">
                  {Number(analytics.engagement_rate_30d).toFixed(2)}%
                </p>
              </div>
            )}
            {analytics.avg_likes_30d != null && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">Avg likes (30d)</p>
                <p className="text-lg font-semibold text-foreground tabular-nums">
                  {Number(analytics.avg_likes_30d).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </p>
              </div>
            )}
            {analytics.reach_proxy_30d != null && (
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs font-medium text-muted-foreground">Reach proxy (30d)</p>
                <p className="text-lg font-semibold text-foreground tabular-nums">
                  {Number(analytics.reach_proxy_30d).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Only approved analytics are shown. No private data, pricing, or contact info.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
          <BarChart2 className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
          <p className="text-sm font-medium text-foreground">{CROSS_USER_ANALYTICS_EMPTY_TITLE}</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{CROSS_USER_ANALYTICS_EMPTY_BODY}</p>
          <button
            type="button"
            onClick={goToPublicProfile}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            <ExternalLink className="h-4 w-4" /> View public profile
          </button>
        </div>
      )}
    </div>
  );
}
