"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import ProfessionSelect from "./ProfessionSelect";
import type { Profession } from "@/lib/professions";
import { User, Building2, Shield, Loader2 } from "lucide-react";

type Step = "invite" | "role" | "profession";

/**
 * X-first onboarding: referral (always) → role (Individual/Org) → profession(s).
 * Invite code is compulsory on first login: no skipping. User must enter a valid code before continuing.
 */
export default function XFirstOnboarding({
  userId,
  accessAllowed,
  inviteOnly,
  setRoute,
  onComplete,
  onAccessGranted,
}: {
  userId: string;
  accessAllowed: boolean | null;
  /** When true, platform is invite-only; referral is required when accessAllowed is false. */
  inviteOnly: boolean | null;
  setRoute: (r: { name: string }) => void;
  onComplete: () => void;
  onAccessGranted?: () => void;
}) {
  /** Invite code required on first login (when not yet redeemed). No skipping. Only optional if we know they are already allowed. */
  const referralRequired = accessAllowed !== true;
  const [step, setStep] = useState<Step>("invite");
  const [inviteCode, setInviteCode] = useState("");
  const [accountType, setAccountType] = useState<"individual" | "company" | null>(null);
  const [selectedProfessions, setSelectedProfessions] = useState<Profession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const handleSkipReferral = () => {
    setError(null);
    setStep("role");
  };

  // Step 1: Referral / invite code. Compulsory on first login (when not yet redeemed); no skip.
  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inviteCode.trim();
    if (referralRequired && !trimmed) {
      setError("Enter an invite code to continue.");
      return;
    }
    if (!referralRequired && !trimmed) {
      setStep("role");
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

  // Step 3: Profession(s) then finish — single server round-trip (profile + professions + profile_complete + invitee_active)
  const handleProfessionFinish = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const res = await fetch(`${base}/api/onboarding/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profession_ids: selectedProfessions.map((p) => p.id) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((json as { error?: string }).error ?? "Could not complete onboarding.");
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
              <h1 className="text-xl font-semibold text-foreground">Referral or invite code</h1>
              <p className="text-sm text-muted-foreground">
                {referralRequired
                  ? "An invite code is required to continue. Enter your referral or invite code."
                  : "Have a referral or invite code? (Optional — we use it for attribution.)"}
              </p>
            </div>
          </div>
          <form onSubmit={handleInviteSubmit} className="space-y-4">
            <div>
              <label htmlFor="invite-code" className="block text-sm font-medium text-foreground mb-2">
                {referralRequired ? "Invite code *" : "Invite code (optional)"}
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
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? "Verifying…" : referralRequired ? "Continue" : "Continue with code"}
              </button>
              {!referralRequired && (
                <button
                  type="button"
                  onClick={handleSkipReferral}
                  disabled={loading}
                  className="w-full h-11 rounded-lg border border-border bg-background text-foreground font-medium hover:bg-muted/50 disabled:opacity-50"
                >
                  Skip
                </button>
              )}
            </div>
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
