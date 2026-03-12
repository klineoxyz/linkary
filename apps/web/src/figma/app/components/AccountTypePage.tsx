"use client";

import React, { useState } from "react";
import { updateMyProfile } from "@/lib/profiles";
import { User, Building2 } from "lucide-react";

/**
 * First-time login: choose Individual or Company. Saves account_type and onboarding_completed_at, then continues to profile.
 */
export default function AccountTypePage({
  userId,
  onComplete,
  setRoute,
}: {
  userId: string;
  onComplete: () => void;
  setRoute: (r: { name: string }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSelect = async (accountType: "individual" | "company") => {
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await updateMyProfile(userId, {
        account_type: accountType,
        onboarding_completed_at: new Date().toISOString(),
      });
      if (err) {
        setError(err);
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

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground text-center">Welcome to Linkary</h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          First time here? Tell us how you’ll use Linkary.
        </p>
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSelect("individual")}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-background p-6 hover:border-primary hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <User className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
            <span className="font-medium text-foreground">Individual</span>
            <span className="text-xs text-muted-foreground text-center">Creator, freelancer, or personal brand</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleSelect("company")}
            className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-border bg-background p-6 hover:border-primary hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <Building2 className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
            <span className="font-medium text-foreground">Company</span>
            <span className="text-xs text-muted-foreground text-center">Brand, agency, or project. Create orgs and hire.</span>
          </button>
        </div>
        {error && (
          <p className="mt-4 text-sm text-destructive text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
