"use client";

import React, { useCallback, useEffect, useState } from "react";
import { X, MapPin } from "lucide-react";

const STORAGE_KEY = "linkary_first_steps_card_dismissed";

/**
 * Dismissible orientation for first-run users. No gamification; link map only.
 */
export default function FirstStepsOnLinkaryCard({
  signedIn,
  orgCount,
}: {
  signedIn: boolean;
  orgCount: number;
}) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }, []);

  if (!signedIn || dismissed) return null;

  return (
    <div
      className="rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-foreground shadow-sm"
      data-testid="first-steps-on-linkary"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-2 min-w-0">
          <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5 stroke-[1.75]" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold text-foreground">First steps on Linkary</p>
            <ul className="mt-2 space-y-1.5 text-muted-foreground list-none pl-0">
              <li>
                <span className="text-foreground font-medium">Profile</span> —{" "}
                <a href="/app/profile" className="text-primary hover:underline">
                  /app/profile
                </a>{" "}
                is your private workspace. Edit basics and links in{" "}
                <a href="/app/profile/edit" className="text-primary hover:underline">
                  Profile edit
                </a>
                ; use <strong>Public preview</strong> there to see your live page.
              </li>
              <li>
                <span className="text-foreground font-medium">Public page</span> — What others see is your URL{" "}
                <code className="text-xs bg-muted px-1 rounded">/{`{your-username}`}</code>. Analytics and raw metrics stay in the app only.
              </li>
              <li>
                <span className="text-foreground font-medium">X &amp; analytics</span> — Connect X in{" "}
                <a href="/app/settings/integrations" className="text-primary hover:underline">
                  Integrations
                </a>
                . Charts in{" "}
                <a href="/app/analytics" className="text-primary hover:underline">
                  Analytics
                </a>{" "}
                use stored data (no live scraping on each visit).
              </li>
              {orgCount === 0 ? (
                <li>
                  <span className="text-foreground font-medium">Company / org work</span> — Create an org below to verify your brand and add team members.
                </li>
              ) : (
                <li>
                  <span className="text-foreground font-medium">Org workspace</span> — Open <strong>My Orgs</strong> below for jobs, sourcing, and members.
                </li>
              )}
            </ul>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
          aria-label="Dismiss first steps"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
