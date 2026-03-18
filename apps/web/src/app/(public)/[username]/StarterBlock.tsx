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
  /** 0–100 completeness from public payload (hero 20, case study 25, gig 25, relation 15, review 15). */
  completenessScore?: number;
  /** Next recommended action when owner view is shown. */
  nextAction?: { label: string; href: string } | null;
  className?: string;
};

/**
 * Shows when profile is "low content" (no hero, no case studies, no reviews, no gigs/relations for org).
 * Visitor: short explanation + View Insights + Request collab/sign in.
 * Owner (detected client-side via /api/me/profile-status isOwner): "Complete your profile" + completeness meter + next action.
 */
export function StarterBlock({
  username,
  profileType,
  profileUrl,
  isLowContent,
  completenessScore = 0,
  nextAction = null,
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
          setIsOwner((j as { isOwner?: boolean }).isOwner === true);
        })
        .catch(() => setIsOwner(false));
    });
  }, [isLowContent, username]);

  if (!isLowContent) return null;

  const insightsHref = `/u/${encodeURIComponent(username)}/insights`;
  const loginRedirect = `/login?redirect=${encodeURIComponent(profileUrl)}`;
  const editHref = "/app/profile/edit";
  const score = Math.min(100, Math.max(0, completenessScore));

  if (isOwner === true) {
    return (
      <section className={className} aria-label="Complete your profile">
        <div className={SECTION_CARD_CLASS}>
          <div className="p-5">
            <h2 className="text-sm font-semibold text-foreground">Complete your profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A fuller page builds trust. Edit in Profile — visitors only see what you publish.
            </p>
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Profile completeness</span>
                <span className="text-sm font-semibold tabular-nums text-foreground">{score}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted/80 border border-border">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all duration-300"
                  style={{ width: `${score}%` }}
                  aria-hidden
                />
              </div>
            </div>
            {nextAction && (
              <Link
                href={nextAction.href}
                className="mt-4 inline-flex items-center rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {nextAction.label}
              </Link>
            )}
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
