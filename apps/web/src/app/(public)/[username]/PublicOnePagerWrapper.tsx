"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PublicOnePager } from "@/components/public/PublicOnePager";

export type EntityView = ReturnType<typeof import("@/lib/publicProfileDTO").dtoToEntityView>;

export function PublicOnePagerWrapper({
  entityView,
  username,
  analyticsSource,
  analyticsInitialized,
  hasXConnected,
}: {
  entityView: EntityView;
  username: string;
  analyticsSource: "worker" | "partial" | "fallback";
  analyticsInitialized: boolean;
  hasXConnected: boolean;
}) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

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
    if (!isOwner || entityView.type !== "profile" || !hasXConnected) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/analytics/ensure-backfill`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ username }),
      }).catch(() => {});
    })();
  }, [isOwner, entityView.type, hasXConnected, username]);

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
