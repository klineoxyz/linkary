"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { updateMyProfile } from "@/lib/profiles";
import { getProfileProfessions, setProfileProfessions } from "@/lib/profileProfessions";
import ProfessionSelect from "./ProfessionSelect";
import type { Profession } from "@/lib/professions";
import { User, Building2, Shield, Loader2 } from "lucide-react";

type Step = "invite" | "role" | "profession";

/**
 * X-first onboarding: invite (if required) → role (Individual/Org) → profession(s).
 * Used when needsOnboarding; does not set onboarding_completed_at until profession step is done.
 */
export default function XFirstOnboarding({
  userId,
  accessAllowed,
  setRoute,
  onComplete,
  onAccessGranted,
}: {
  userId: string;
  /** When false, show invite step first (invite-only mode). */
  accessAllowed: boolean | null;
  setRoute: (r: { name: string }) => void;
  onComplete: () => void;
  /** Call after successful invite redeem so parent can refresh access and me. */
  onAccessGranted?: () => void;
}) {
  const needInviteStep = accessAllowed === false;
  const [step, setStep] = useState<Step>(() => (needInviteStep ? "invite" : "role"));
  const [inviteCode, setInviteCode] = useState("");
  const [accountType, setAccountType] = useState<"individual" | "company" | null>(null);
  const [selectedProfessions, setSelectedProfessions] = useState<Profession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  // Step 1: Invite code (when invite-only and not yet allowed)
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inviteCode.trim();
    if (!trimmed) {
      setError("Enter an invite code.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setError("Session expired. Please sign in again.");
        setLoading(false);
        return;
      }
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/invites/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        onAccessGranted?.();
        setStep("role");
      } else {
        const msg = json.error ?? "Invalid or unavailable code.";
        if (msg === "already_redeemed") setError("This code was already used.");
        else if (msg === "invalid_or_unavailable_code") setError("Invalid or expired code. Check the code and try again.");
        else setError(msg);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Role
  const handleRoleSelect = async (type: "individual" | "company") => {
    setError(null);
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        setError("Session expired. Please sign in again.");
        setLoading(false);
        return;
      }
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/onboarding/set-account-type`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ account_type: type }),
      });
      setLoading(false);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Could not set account type.");
        return;
      }
      setAccountType(type);
      setStep("profession");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  };

  // Step 3: Profession(s) then finish
  const handleProfessionFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: profErr } = await setProfileProfessions(userId, selectedProfessions.map((p) => p.id));
      if (profErr) {
        setError(profErr);
        setLoading(false);
        return;
      }
      const { error: updateErr } = await updateMyProfile(userId, {
        onboarding_completed_at: new Date().toISOString(),
      });
      if (updateErr) {
        setError(updateErr);
        setLoading(false);
        return;
      }
      onComplete();
      setRoute({ name: "profile" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  };

  if (step === "invite") {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Invite code</h1>
              <p className="text-sm text-muted-foreground">
                Linkary is invite-only. Enter your referral or invite code to continue.
              </p>
            </div>
          </div>
          <form onSubmit={handleInviteSubmit} className="space-y-4">
            <div>
              <label htmlFor="invite-code" className="block text-sm font-medium text-foreground mb-2">
                Invite code
              </label>
              <input
                id="invite-code"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="Enter code"
                className="w-full h-11 px-4 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                autoComplete="off"
                disabled={loading}
              />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Verifying…" : "Continue"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (step === "role") {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-foreground text-center">Welcome to Linkary</h1>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            How will you use Linkary?
          </p>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleRoleSelect("individual")}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-background p-6 hover:border-primary hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <User className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
              <span className="font-medium text-foreground">Individual</span>
              <span className="text-xs text-muted-foreground text-center">Creator, freelancer, or personal brand</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleRoleSelect("company")}
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-background p-6 hover:border-primary hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <Building2 className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
              <span className="font-medium text-foreground">Company</span>
              <span className="text-xs text-muted-foreground text-center">Brand, agency, or project. Create orgs and hire.</span>
            </button>
          </div>
          {error && <p className="mt-4 text-sm text-destructive text-center">{error}</p>}
        </div>
      </div>
    );
  }

  // Step: profession
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground text-center">Almost there</h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          What best describes you? You can change this later in your profile.
        </p>
        <form onSubmit={handleProfessionFinish} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Role(s) / profession(s)</label>
            <ProfessionSelect
              selectedProfessions={selectedProfessions}
              onChange={setSelectedProfessions}
              allowCreate
              placeholder="e.g. Founder, BD, Creator…"
            />
            <p className="text-xs text-muted-foreground mt-1">Optional. Editable later in Settings → Roles &amp; skills.</p>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Saving…" : "Finish"}
          </button>
        </form>
      </div>
    </div>
  );
}
