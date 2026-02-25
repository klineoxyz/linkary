"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { PublicOnePager } from "@/components/public/PublicOnePager";
import { dtoToEntityView } from "@/lib/publicProfileDTO";
import type { PublicEntityView } from "@/lib/publicProfileDTO";

const ENSURE_BACKFILL_COOLDOWN_KEY = "linkary_ensure_backfill_ts";
const ENSURE_BACKFILL_COOLDOWN_MS = 10 * 60 * 1000;
const BAD_ENSURE_BACKFILL_REASONS = ["no_service_key", "no_x_handle", "profile_not_found", "insert_failed"] as const;
function isEnsureBackfillFailure(res: Response, body: { enqueued?: boolean; reason?: string }): boolean {
  if (!res.ok) return true;
  if (body?.enqueued === false && body?.reason && BAD_ENSURE_BACKFILL_REASONS.includes(body.reason as never)) return true;
  return false;
}

export function PublicOnePagerWrapper({
  entityView: initialEntityView,
  username,
  analyticsSource: initialAnalyticsSource,
  analyticsInitialized: initialAnalyticsInitialized,
  hasXConnected,
  brochure = false,
}: {
  entityView: PublicEntityView;
  username: string;
  analyticsSource: "worker" | "partial" | "fallback";
  analyticsInitialized: boolean;
  hasXConnected: boolean;
  brochure?: boolean;
}) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [liveEntityView, setLiveEntityView] = useState<PublicEntityView | null>(null);
  const [liveAnalyticsSource, setLiveAnalyticsSource] = useState<"worker" | "partial" | "fallback" | null>(null);
  const [liveAnalyticsInitialized, setLiveAnalyticsInitialized] = useState<boolean | null>(null);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [ensureBackfillFailed, setEnsureBackfillFailed] = useState(false);
  const ensureBackfillCalled = useRef(false);

  const fetchOwnerDto = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(
      `${base}/api/public/profile-owner/${encodeURIComponent(username)}`,
      { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" }
    );
    if (!res.ok) return;
    const dto = await res.json();
    const view = dtoToEntityView(dto);
    setLiveEntityView(view);
    setLiveAnalyticsSource(dto.analytics?.source ?? null);
    setLiveAnalyticsInitialized(dto.analytics?.initialized ?? null);
  }, [username]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session?.user);
      if (!session?.access_token) {
        setIsOwner(false);
        return;
      }
      const res = await fetch(
        `${typeof window !== "undefined" ? window.location.origin : ""}/api/public/ownership?username=${encodeURIComponent(username)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (res.ok) {
        const j = await res.json();
        setIsOwner(j.isOwner === true);
        if (j.isOwner === true) {
          fetchOwnerDto();
        }
      } else {
        setIsOwner(false);
      }
    })();
  }, [username, fetchOwnerDto]);

  useEffect(() => {
    if (!isOwner || entityView.type !== "profile" || !hasXConnected || analyticsInitialized) return;
    if (ensureBackfillCalled.current) return;
    const now = Date.now();
    try {
      const last = typeof localStorage !== "undefined" ? localStorage.getItem(ENSURE_BACKFILL_COOLDOWN_KEY) : null;
      if (last && now - parseInt(last, 10) < ENSURE_BACKFILL_COOLDOWN_MS) return;
    } catch {
      /* ignore */
    }
    ensureBackfillCalled.current = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      try {
        const res = await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/analytics/ensure-backfill`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ username }),
        });
        const body = await res.json().catch(() => ({}));
        if (isEnsureBackfillFailure(res, body)) {
          console.error("[ANALYTICS_INIT_FAILED] ensure-backfill (PublicOnePager)", res.status, body);
          setEnsureBackfillFailed(true);
          ensureBackfillCalled.current = false;
          return;
        }
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(ENSURE_BACKFILL_COOLDOWN_KEY, String(Date.now()));
        }
      } catch (err) {
        console.error("[ANALYTICS_INIT_FAILED] ensure-backfill (PublicOnePager)", err);
        setEnsureBackfillFailed(true);
        ensureBackfillCalled.current = false;
      }
    })();
  }, [isOwner, initialEntityView.type, hasXConnected, initialAnalyticsInitialized, username]);

  const entityView = liveEntityView ?? initialEntityView;
  const analyticsSource = liveAnalyticsSource ?? initialAnalyticsSource;
  const analyticsInitialized = liveAnalyticsInitialized ?? initialAnalyticsInitialized;

  const handleRefresh = async () => {
    if (!isOwner || refreshLoading) return;
    setRefreshLoading(true);
    await fetchOwnerDto();
    setRefreshLoading(false);
  };

  const handleRetryEnsureBackfill = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const res = await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/analytics/ensure-backfill`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ username }),
    });
    const body = await res.json().catch(() => ({}));
    if (!isEnsureBackfillFailure(res, body)) {
      setEnsureBackfillFailed(false);
      if (typeof localStorage !== "undefined") localStorage.setItem(ENSURE_BACKFILL_COOLDOWN_KEY, String(Date.now()));
      fetchOwnerDto();
    }
  }, [username, fetchOwnerDto]);

  return (
    <div className="relative">
      {ensureBackfillFailed && isOwner && !brochure && (
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-3 py-2 bg-amber-100 border-b border-amber-300 text-amber-900 text-xs">
          <span>Analytics init failed. Retry to start 90-day backfill.</span>
          <button
            type="button"
            onClick={handleRetryEnsureBackfill}
            className="px-2 py-1 rounded border border-amber-600 bg-amber-600 text-white hover:bg-amber-700 font-medium"
          >
            Retry
          </button>
        </div>
      )}
      {isOwner && !brochure && !ensureBackfillFailed && (
        <div className="sticky top-0 z-10 flex justify-end p-2 bg-background/80 backdrop-blur-sm border-b border-border/50">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshLoading}
            className="text-xs px-2 py-1 rounded border border-border bg-muted/50 text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
            aria-label="Refresh to see latest changes"
          >
            {refreshLoading ? "Refreshing…" : "Refresh now"}
          </button>
        </div>
      )}
      <PublicOnePager
        entity={entityView}
        username={username}
        isLoggedIn={isLoggedIn}
        isOwner={brochure ? false : isOwner}
        analyticsSource={analyticsSource}
        analyticsInitialized={analyticsInitialized}
        hasXConnected={hasXConnected}
        brochure={brochure}
      />
    </div>
  );
}
