"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import type { OrgType } from "@/lib/orgs";
import { createOrg, checkSlugAvailable, sanitizeSlug } from "@/lib/orgs";

const ORG_TYPES: { value: OrgType; label: string }[] = [
  { value: "brand", label: "Brand" },
  { value: "project", label: "Project" },
  { value: "agency", label: "Agency" },
  { value: "company", label: "Company" },
];

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
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [orgType, setOrgType] = useState<OrgType>("brand");
  const [tagline, setTagline] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [suggestedSlug, setSuggestedSlug] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slug.trim() ? sanitizeSlug(slug) : "";
  const slugToCheck = effectiveSlug || (name.trim() ? sanitizeSlug(name.trim().toLowerCase().replace(/\s+/g, "-")) : "");

  const checkSlug = async () => {
    if (slugToCheck.length < 2) {
      setSlugError(null);
      setSuggestedSlug(null);
      return;
    }
    setSlugChecking(true);
    setSlugError(null);
    setSuggestedSlug(null);
    const result = await checkSlugAvailable(slugToCheck);
    setSlugChecking(false);
    if (!result.available) {
      setSlugError("Handle already taken.");
      if (result.suggested) setSuggestedSlug(result.suggested);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSlugError(null);
    setSuggestedSlug(null);
    const finalName = name.trim();
    if (!finalName) {
      setError("Name is required.");
      return;
    }
    if (slugToCheck.length < 2) {
      setError("Handle must be at least 2 characters.");
      return;
    }
    const result = await checkSlugAvailable(slugToCheck);
    if (!result.available) {
      setSlugError("Handle already taken. Try: " + (result.suggested ?? slugToCheck + "-2"));
      if (result.suggested) setSuggestedSlug(result.suggested);
      return;
    }
    setLoading(true);
    const { data, error: err } = await createOrg(userId, {
      name: finalName,
      slug: slugToCheck,
      org_type: orgType,
      tagline: tagline.trim() || undefined,
      website: website.trim() || undefined,
    });
    setLoading(false);
    if (err) {
      const companyRequired = /ORG_COMPANY_REQUIRED|company accounts can create/i.test(String(err));
      const displayMsg = companyRequired
        ? "Only company accounts can create an organization. Switch to a Company account in Settings."
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

  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ring focus:border-border";
  const labelClass = "block text-sm font-medium text-zinc-700 mb-1.5";

  return (
    <div className="fixed inset-0 z-[100] h-screen w-screen flex items-center justify-center p-4 sm:p-6 bg-zinc-900/40 overflow-hidden">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl w-full max-w-lg flex flex-col max-h-[calc(100vh-2rem)] min-h-0 overflow-hidden">
        <div className="px-6 sm:px-8 py-5 flex items-start justify-between border-b border-zinc-200 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Create org or brand</h2>
            <p className="text-sm text-zinc-500 mt-0.5">You&apos;ll be the owner. Connect X in the org Settings after creation to verify.</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-100 text-zinc-500 shrink-0" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 sm:px-8 py-5 flex flex-col flex-1 min-h-0 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
              {error}
              {(error.includes("company accounts can create") || error.includes("ORG_COMPANY_REQUIRED")) && (
                <p className="mt-2">
                  <a href="/onboarding" className="underline font-medium text-primary">Switch to Company account</a> or <a href="/settings" className="underline font-medium text-primary">Settings</a>.
                </p>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className={labelClass}>Type</label>
              <div className="flex gap-2 flex-wrap">
                {ORG_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setOrgType(t.value)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                      orgType === t.value ? "border-primary bg-accent text-primary" : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={labelClass}>Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. DESI Crypto CLUB"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Handle (linkary.xyz/@handle) *</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value.replace(/^@/, "").toLowerCase().replace(/[^a-z0-9-]/g, ""));
                  setSlugError(null);
                  setSuggestedSlug(null);
                }}
                onBlur={checkSlug}
                placeholder="e.g. desicryptoclub"
                className={inputClass}
              />
              <p className="text-xs text-zinc-500 mt-1">URL-friendly, unique. Leave blank to derive from name.</p>
              {slugChecking && <p className="text-xs text-zinc-500 mt-1">Checking…</p>}
              {slugError && (
                <p className="text-sm text-destructive mt-1">
                  {slugError}
                  {suggestedSlug && (
                    <>
                      {" "}
                      Try:{" "}
                      <button type="button" className="underline font-medium" onClick={() => { setSlug(suggestedSlug ?? ""); setSlugError(null); setSuggestedSlug(null); }}>
                        {suggestedSlug}
                      </button>
                    </>
                  )}
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Tagline (optional)</label>
              <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="One line that describes your org" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Website (optional)</label>
              <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." className={inputClass} />
            </div>
          </div>

          <div className="flex gap-3 mt-6 pt-4 border-t border-zinc-200 shrink-0">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-300 text-zinc-700 font-medium hover:bg-zinc-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || slugToCheck.length < 2 || !!slugError}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary hover:opacity-90 text-primary-foreground font-medium disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
