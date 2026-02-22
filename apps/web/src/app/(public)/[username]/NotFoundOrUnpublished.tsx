"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { UnpublishedView } from "./UnpublishedView";
import { NotFoundClaimView } from "./NotFoundClaimView";

type Status = "loading" | "not_found" | "unpublished";

export function NotFoundOrUnpublished({ requestedUsername }: { requestedUsername: string }) {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setStatus("not_found");
        return;
      }
      const res = await fetch(
        `${typeof window !== "undefined" ? window.location.origin : ""}/api/me/profile-status?username=${encodeURIComponent(requestedUsername)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (!res.ok) {
        setStatus("not_found");
        return;
      }
      const j = await res.json();
      if (j.status === "unpublished") {
        setStatus("unpublished");
      } else {
        setStatus("not_found");
      }
    })();
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
