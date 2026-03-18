"use client";

import React, { useCallback, useEffect, useState } from "react";
import { X, MapPin, CheckCircle2, Circle, PartyPopper, Building2, Sparkles } from "lucide-react";
import { RC_STORAGE } from "@/lib/releaseCandidateUx";

export type ProfileHints = {
  accountType: string | null | undefined;
  hasDisplayName: boolean;
  hasUsername: boolean;
  hasXOnProfile: boolean;
  publicSlug: string | null;
};

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function removeSession(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/**
 * One-time success banners + role-aware next-step checklist. Dismissible; no gamification.
 */
export default function NextBestActionSuite({
  signedIn,
  orgCount,
  profileHints,
}: {
  signedIn: boolean;
  orgCount: number;
  profileHints: ProfileHints | null;
}) {
  const [onboardingBanner, setOnboardingBanner] = useState(false);
  const [orgBanner, setOrgBanner] = useState(false);
  const [checklistDismissed, setChecklistDismissed] = useState(true);
  const [shareNudge, setShareNudge] = useState(false);

  useEffect(() => {
    setOnboardingBanner(readSession(RC_STORAGE.ONBOARDING_JUST_COMPLETED) === "1");
    setOrgBanner(!!readSession(RC_STORAGE.ORG_JUST_CREATED));
    setChecklistDismissed(readSession(RC_STORAGE.NEXT_STEPS_DISMISSED) === "1");
    const slug = profileHints?.publicSlug?.trim();
    const ready =
      profileHints?.hasDisplayName &&
      profileHints?.hasUsername &&
      slug &&
      readSession(RC_STORAGE.SHARE_READY_NUDGE) !== "1";
    setShareNudge(!!ready);
  }, [profileHints?.hasDisplayName, profileHints?.hasUsername, profileHints?.publicSlug]);

  const dismissOnboarding = useCallback(() => {
    removeSession(RC_STORAGE.ONBOARDING_JUST_COMPLETED);
    setOnboardingBanner(false);
  }, []);

  const dismissOrg = useCallback(() => {
    removeSession(RC_STORAGE.ORG_JUST_CREATED);
    setOrgBanner(false);
  }, []);

  const dismissChecklist = useCallback(() => {
    writeSession(RC_STORAGE.NEXT_STEPS_DISMISSED, "1");
    setChecklistDismissed(true);
  }, []);

  const dismissShare = useCallback(() => {
    writeSession(RC_STORAGE.SHARE_READY_NUDGE, "1");
    setShareNudge(false);
  }, []);

  if (!signedIn) return null;

  const isCompany = profileHints?.accountType === "company";
  const slug = profileHints?.publicSlug?.trim() || "";
  const baseUrl = typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";
  const publicUrl = slug ? `${baseUrl}/${encodeURIComponent(slug)}` : "";

  const steps: Array<{ done: boolean; label: string; hint: string; href: string }> = [];

  if (isCompany) {
    steps.push({
      done: orgCount > 0,
      label: orgCount > 0 ? "Open your org workspace" : "Create your org on Linkary",
      hint:
        orgCount > 0
          ? "Jobs, sourcing, and team live in My Orgs — separate from your personal profile."
          : "Use Create Org below. Your personal page stays yours for your own credibility.",
      href: "#my-orgs",
    });
  }

  steps.push(
    {
      done: !!profileHints?.hasDisplayName,
      label: "Add your name & bio",
      hint: "Shown on your public page after you save.",
      href: "/app/profile/edit",
    },
    {
      done: !!profileHints?.hasUsername,
      label: "Set your public username",
      hint: "This becomes your shareable link.",
      href: "/app/profile/edit#basics",
    },
    {
      done: !!profileHints?.hasXOnProfile,
      label: "Connect X",
      hint: "Needed for stored analytics (Integrations).",
      href: "/app/settings/integrations",
    },
    {
      done: false,
      label: "Open Analytics",
      hint: "Your metrics — private; not on your public page.",
      href: "/app/analytics",
    },
    {
      done: !!slug,
      label: "Preview your public page",
      hint: "What visitors see — honest snapshot only.",
      href: slug ? `/${encodeURIComponent(slug)}` : "/app/profile",
    }
  );

  const checklistTitle =
    isCompany && orgCount === 0
      ? "Company setup — start here"
      : isCompany
        ? "Personal profile + org workspace"
        : "Your creator checklist";

  const personalVsOrg =
    isCompany && orgCount > 0 ? (
      <p className="text-xs text-muted-foreground mt-2 border-t border-border/60 pt-2">
        <strong className="text-foreground">Personal</strong> (Profile, Analytics) is yours.{" "}
        <strong className="text-foreground">Org</strong> (My Orgs below) is for the brand — jobs, sourcing, and team.
      </p>
    ) : isCompany && orgCount === 0 ? (
      <p className="text-xs text-muted-foreground mt-2 border-t border-border/60 pt-2">
        As <strong className="text-foreground">Company</strong>, create an org first for team workflows. Your personal profile is still yours for credibility and discovery.
      </p>
    ) : null;

  return (
    <div className="space-y-3" data-testid="next-best-action-suite">
      {onboardingBanner && (
        <div
          className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-foreground flex gap-3 items-start"
          role="status"
        >
          <PartyPopper className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-emerald-950">You&apos;re in — welcome to Linkary</p>
            <p className="text-emerald-900/90 mt-0.5">
              Next: finish a few quick steps below (profile, public link, optional X). Nothing here is broken — you&apos;re just getting set up.
            </p>
          </div>
          <button type="button" onClick={dismissOnboarding} className="shrink-0 p-1 rounded-lg hover:bg-emerald-500/20" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {orgBanner && (
        <div
          className="rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground flex gap-3 items-start"
          role="status"
        >
          <Building2 className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Org workspace ready</p>
            <p className="text-muted-foreground mt-0.5">
              Open your org below → <strong className="text-foreground">Members</strong> to add team, then{" "}
              <strong className="text-foreground">Jobs</strong> or <strong className="text-foreground">Sourcing</strong> when you&apos;re ready.
            </p>
          </div>
          <button type="button" onClick={dismissOrg} className="shrink-0 p-1 rounded-lg hover:bg-primary/15" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {shareNudge && slug && (
        <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex gap-2 items-start min-w-0">
            <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="font-medium text-foreground">Profile ready to share</p>
              <p className="text-xs text-muted-foreground break-all">{publicUrl}</p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              className="text-xs font-medium px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90"
              onClick={() => {
                void navigator.clipboard.writeText(publicUrl);
              }}
            >
              Copy link
            </button>
            <button type="button" onClick={dismissShare} className="text-xs text-muted-foreground px-2">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {!checklistDismissed && (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 px-3 sm:px-4 py-3 text-sm text-foreground shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex gap-2 min-w-0">
              <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5 stroke-[1.75]" aria-hidden />
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{checklistTitle}</p>
                <ul className="mt-2 space-y-2 list-none pl-0">
                  {steps.map((s, i) => (
                    <li key={i} className="flex gap-2 items-start text-muted-foreground">
                      {s.done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" aria-hidden />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-0.5" aria-hidden />
                      )}
                      <span>
                        <a href={s.href} className="font-medium text-foreground hover:text-primary hover:underline">
                          {s.label}
                        </a>
                        <span className="block text-xs mt-0.5">{s.hint}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                {personalVsOrg}
                <p className="text-[11px] text-muted-foreground mt-3 pt-2 border-t border-border/50">
                  <strong className="text-foreground">Map:</strong> <a href="/app/profile" className="text-primary hover:underline">Profile</a> (private workspace) ·{" "}
                  <a href="/app/profile/edit" className="text-primary hover:underline">Profile edit</a> (what goes public) ·{" "}
                  <code className="text-[10px] bg-muted px-1 rounded">/{slug || "username"}</code> (visitor view) ·{" "}
                  <a href="/app/analytics" className="text-primary hover:underline">Analytics</a> (your metrics, app-only)
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissChecklist}
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
              aria-label="Dismiss checklist"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
