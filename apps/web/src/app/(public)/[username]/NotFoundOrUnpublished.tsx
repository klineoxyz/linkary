"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { UnpublishedView } from "./UnpublishedView";
import { NotFoundClaimView } from "./NotFoundClaimView";

type Status = "loading" | "not_found" | "unpublished";

export function NotFoundOrUnpublished({ requestedUsername }: { requestedUsername: string }) {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";

    const resolveStatus = async (session: { access_token: string } | null) => {
      if (!session?.access_token) {
        setStatus("not_found");
        return;
      }
      const res = await fetch(
        `${origin}/api/me/profile-status?username=${encodeURIComponent(requestedUsername)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (!res.ok) {
        setStatus("not_found");
        return;
      }
      const j = await res.json();
      if ((j as { isOwner?: boolean; status?: string }).isOwner === true && (j as { status?: string }).status === "unpublished") {
        setStatus("unpublished");
      } else {
        setStatus("not_found");
      }
    };

    // Wait for auth to be ready (session may restore from storage after load).
    // Using only onAuthStateChange avoids showing "Claim" before session is restored.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveStatus(session ?? null);
    });

    return () => subscription?.unsubscribe();
  }, [requestedUsername]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (status === "unpublished") {
    return <UnpublishedView username={requestedUsername} />;
  }

  return <NotFoundClaimView requestedUsername={requestedUsername} />;
}
