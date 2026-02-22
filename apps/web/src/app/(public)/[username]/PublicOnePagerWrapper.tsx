"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { PublicOnePager } from "@/components/public/PublicOnePager";
import type { PublicEntityView } from "@/lib/publicProfileDTO";

const ENSURE_BACKFILL_COOLDOWN_KEY = "linkary_ensure_backfill_ts";
const ENSURE_BACKFILL_COOLDOWN_MS = 10 * 60 * 1000;

export function PublicOnePagerWrapper({
  entityView,
  username,
  analyticsSource,
  analyticsInitialized,
  hasXConnected,
}: {
  entityView: PublicEntityView;
  username: string;
  analyticsSource: "worker" | "partial" | "fallback";
  analyticsInitialized: boolean;
  hasXConnected: boolean;
}) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const ensureBackfillCalled = useRef(false);

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
      } else {
        setIsOwner(false);
      }
    })();
  }, [username]);

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
        await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/analytics/ensure-backfill`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ username }),
        });
        if (typeof localStorage !== "undefined") {
          localStorage.setItem(ENSURE_BACKFILL_COOLDOWN_KEY, String(Date.now()));
        }
      } catch {
        ensureBackfillCalled.current = false;
      }
    })();
  }, [isOwner, entityView.type, hasXConnected, analyticsInitialized, username]);

  return (
    <PublicOnePager
      entity={entityView}
      username={username}
      isLoggedIn={isLoggedIn}
      isOwner={isOwner}
      analyticsSource={analyticsSource}
      analyticsInitialized={analyticsInitialized}
      hasXConnected={hasXConnected}
    />
  );
}
