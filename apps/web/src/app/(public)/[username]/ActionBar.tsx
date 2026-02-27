"use client";

import Link from "next/link";
import React from "react";

const ROUTES = {
  profileEdit: "/profile/edit",
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
  isAuthenticated?: boolean;
  canApplyToGigs?: boolean;
  className?: string;
};

export function ActionBar({
  profileType,
  username,
  profileUrl,
  isAuthenticated = false,
  canApplyToGigs = false,
  className = "",
}: ActionBarProps) {
  const insightsHref = `/u/${encodeURIComponent(username)}/insights`;

  if (profileType === "individual") {
    const requestHref = isAuthenticated ? profileUrl : buildRedirect(profileUrl);
    return (
      <nav className={`flex flex-wrap items-center gap-2 ${className}`} aria-label="Profile actions">
        <Link
          href={requestHref}
          className="inline-flex items-center rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {isAuthenticated ? "Request collab" : "Sign in to contact"}
        </Link>
        <Link
          href={insightsHref}
          className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-accent/50 hover:border-primary/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          View Insights
        </Link>
      </nav>
    );
  }

  const postGigHref = isAuthenticated ? ROUTES.profileEdit : buildRedirect(ROUTES.profileEdit);
  return (
    <nav className={`flex flex-wrap items-center gap-2 ${className}`} aria-label="Profile actions">
      <Link
        href={postGigHref}
        className="inline-flex items-center rounded-lg border border-primary bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {isAuthenticated ? "Post a gig" : "Sign in to post a gig"}
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
