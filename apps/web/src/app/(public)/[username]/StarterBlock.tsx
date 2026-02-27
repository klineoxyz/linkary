"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const SECTION_CARD_CLASS =
  "rounded-2xl border border-border bg-card/95 shadow-sm transition-all duration-200 hover:border-primary/20 hover:shadow-md hover:shadow-primary/10";

export type StarterBlockProps = {
  username: string;
  profileType: "individual" | "project" | "company";
  profileUrl: string;
  isLowContent: boolean;
  className?: string;
};

/**
 * Shows when profile is "low content" (no hero, no case studies, no reviews, no gigs/relations for org).
 * Visitor: short explanation + View Insights + Request collab/sign in.
 * Owner (detected client-side via /api/me/profile-status): "Complete your profile" checklist with links to /profile/edit.
 */
export function StarterBlock({
  username,
  profileType,
  profileUrl,
  isLowContent,
  className = "",
}: StarterBlockProps) {
  const [isOwner, setIsOwner] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isLowContent) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) {
        setIsOwner(false);
        return;
      }
      const base = typeof window !== "undefined" ? window.location.origin : "";
      fetch(`${base}/api/me/profile-status?username=${encodeURIComponent(username)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((j) => {
          const status = (j as { status?: string }).status;
          setIsOwner(status === "published" || status === "unpublished");
        })
        .catch(() => setIsOwner(false));
    });
  }, [isLowContent, username]);

  if (!isLowContent) return null;

  const insightsHref = `/u/${encodeURIComponent(username)}/insights`;
  const loginRedirect = `/login?redirect=${encodeURIComponent(profileUrl)}`;
  const editHref = "/profile/edit";

  if (isOwner === true) {
    return (
      <section className={className} aria-label="Complete your profile">
        <div className={SECTION_CARD_CLASS}>
          <div className="p-5">
            <h2 className="text-sm font-semibold text-foreground">Complete your profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">Add more to your page so visitors see your best work.</p>
            <ul className="mt-4 space-y-2 text-sm text-foreground">
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
                <Link href={`${editHref}#basics`} className="font-medium text-primary hover:underline">
                  Add a bio and links
                </Link>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
                <Link href={`${editHref}#case-studies`} className="font-medium text-primary hover:underline">
                  Add a proof card (case study)
                </Link>
              </li>
              {profileType !== "individual" && (
                <li className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
                  <Link href={`${editHref}#gigs`} className="font-medium text-primary hover:underline">
                    Post an open gig
                  </Link>
                </li>
              )}
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
                <Link href={editHref} className="font-medium text-primary hover:underline">
                  Edit profile
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={className} aria-label="Get started">
      <div className={SECTION_CARD_CLASS}>
        <div className="p-5">
          <h2 className="text-sm font-semibold text-foreground">This profile is getting started</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Check back soon for case studies, reviews, and more. You can view insights or reach out.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={insightsHref}
              className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent/50 hover:border-primary/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              View Insights
            </Link>
            <Link
              href={loginRedirect}
              className="inline-flex items-center rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Sign in to contact
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
