"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import type { OrgType } from "@/lib/orgs";
import { createOrg } from "@/lib/orgs";

/** Create org with minimal placeholder; user connects X and fills details on the org page. */
function generatePlaceholderSlug(): string {
  return "org-" + Math.random().toString(36).slice(2, 10);
}

export default function CreateOrgModal({
  onClose,
  onSuccess,
  onError,
  userId,
}: {
  onClose: () => void;
  onSuccess: (orgId: string, slug: string) => void;
  onError?: (message: string) => void;
  userId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnectX = async () => {
    setError(null);
    setLoading(true);
    const slug = generatePlaceholderSlug();
    const { data, error: err } = await createOrg(userId, {
      name: "My org",
      org_type: "brand" as OrgType,
      slug,
    });
    setLoading(false);
    if (err) {
      const companyRequired = /ORG_COMPANY_REQUIRED|company accounts can create/i.test(String(err));
      const displayMsg = companyRequired
        ? "Only company accounts can create an organization. Switch to a Company account in settings to create an org."
        : String(err);
      setError(displayMsg);
      onError?.(String(err));
      return;
    }
    if (data) {
      onSuccess(data.id, data.slug ?? data.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] h-screen w-screen flex items-center justify-center p-4 sm:p-6 bg-zinc-900/40 overflow-hidden">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl w-full max-w-md flex flex-col overflow-hidden">
        <div className="px-6 sm:px-8 py-5 flex items-start justify-between border-b border-zinc-200 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Create org</h2>
            <p className="text-sm text-zinc-500 mt-0.5">Connect your org&apos;s X account to create and verify it.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500 shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 sm:px-8 py-6 flex flex-col gap-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              {error}
              {(error.includes("company accounts can create") || error.includes("ORG_COMPANY_REQUIRED")) && (
                <p className="mt-2">
                  <a href="/onboarding" className="underline font-medium text-primary">Switch to Company account</a>
                  {" "}or go to{" "}
                  <a href="/settings" className="underline font-medium text-primary">Settings</a>.
                </p>
              )}
            </div>
          )}
          <p className="text-sm text-zinc-600">
            You can add the org name, slug, tagline, and other details after connecting. You&apos;ll sign in with the org&apos;s X account to verify ownership.
          </p>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-300 text-zinc-700 font-medium hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConnectX}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary hover:opacity-90 text-primary-foreground font-medium disabled:opacity-50"
            >
              {loading ? "Creating…" : "Connect X account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
