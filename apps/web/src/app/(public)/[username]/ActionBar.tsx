"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { RequestCollabModal } from "./RequestCollabModal";

const ROUTES = {
  profileEdit: "/app/profile/edit",
  explore: "/explore",
  login: "/login",
} as const;

function buildRedirect(path: string): string {
  return `${ROUTES.login}?redirect=${encodeURIComponent(path)}`;
}

export type ActionBarProps = {
  profileType: "individual" | "project" | "company";
  username: string;
  profileUrl: string;
  /** @deprecated Server must not pass auth; ActionBar checks session client-side for ISR-safe HTML. */
  isAuthenticated?: boolean;
  canApplyToGigs?: boolean;
  className?: string;
};

/**
 * Action bar CTAs. Always renders unauth labels/links in initial HTML (ISR-safe).
 * After hydration, checks session client-side and upgrades to authenticated CTAs if logged in.
 */
export function ActionBar({
  profileType,
  username,
  profileUrl,
  isAuthenticated: _serverAuthIgnored = false,
  canApplyToGigs = false,
  className = "",
}: ActionBarProps) {
  const [authed, setAuthed] = useState(false);
  const [collabModalOpen, setCollabModalOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session);
    });
  }, []);

  const insightsHref = `/u/${encodeURIComponent(username)}/insights`;

  if (profileType === "individual") {
    return (
      <nav className={`flex flex-wrap items-center gap-2 ${className}`} aria-label="Profile actions">
        {authed ? (
          <>
            <button
              type="button"
              onClick={() => setCollabModalOpen(true)}
              className="inline-flex items-center rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Request collab
            </button>
            {collabModalOpen && (
              <RequestCollabModal
                targetUsername={username}
                onClose={() => setCollabModalOpen(false)}
                onSuccess={() => setCollabModalOpen(false)}
              />
            )}
          </>
        ) : (
          <Link
            href={buildRedirect(profileUrl)}
            className="inline-flex items-center rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Sign in to contact
          </Link>
        )}
        <Link
          href={insightsHref}
          className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent/50 hover:border-primary/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          View Insights
        </Link>
      </nav>
    );
  }

  const postGigHref = authed ? ROUTES.profileEdit : buildRedirect(ROUTES.profileEdit);
  return (
    <nav className={`flex flex-wrap items-center gap-2 ${className}`} aria-label="Profile actions">
      <Link
        href={postGigHref}
        className="inline-flex items-center rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {authed ? "Post a gig" : "Sign in to post a gig"}
      </Link>
      <Link
        href={ROUTES.explore}
        className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent/50 hover:border-primary/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        Browse creators
      </Link>
      <Link
        href={insightsHref}
        className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        View Insights
      </Link>
    </nav>
  );
}
