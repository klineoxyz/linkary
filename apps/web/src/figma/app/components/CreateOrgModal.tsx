"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import type { OrgType } from "@/lib/orgs";
import { createOrg, checkSlugAvailable, sanitizeSlug } from "@/lib/orgs";

const ORG_TYPES: { value: OrgType; label: string }[] = [
  { value: "company", label: "Company" },
  { value: "brand", label: "Brand" },
  { value: "project", label: "Project" },
  { value: "agency", label: "Agency" },
];

export default function CreateOrgModal({
  onClose,
  onSuccess,
  userId,
}: {
  onClose: () => void;
  onSuccess: (orgId: string, slug: string) => void;
  userId: string;
}) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter_username, setTwitterUsername] = useState("");
  const [logo_url, setLogoUrl] = useState("");
  const [org_type, setOrgType] = useState<OrgType>("brand");
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
      setSlugError("Slug already taken.");
      if (result.suggested) setSuggestedSlug(result.suggested);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSlugError(null);
    setSuggestedSlug(null);
    if (slugToCheck.length >= 2) {
      const result = await checkSlugAvailable(slugToCheck);
      if (!result.available) {
        setSlugError("Slug already taken. Try: " + (result.suggested ?? slugToCheck + "-2"));
        if (result.suggested) setSuggestedSlug(result.suggested);
        return;
      }
    }
    setLoading(true);
    const { data, error: err } = await createOrg(userId, {
      slug: effectiveSlug || undefined,
      name: name.trim(),
      tagline: tagline.trim() || undefined,
      website: website.trim() || undefined,
      twitter_username: twitter_username.trim().replace(/^@/, "") || undefined,
      logo_url: logo_url.trim() || undefined,
      org_type,
    });
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    if (data) {
      onSuccess(data.id, data.slug ?? data.id);
      onClose();
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg border border-zinc-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-ring focus:border-border";
  const labelClass = "block text-sm font-medium text-zinc-700 mb-1.5";

  return (
    <div className="fixed inset-0 z-[100] h-screen w-screen flex items-center justify-center p-4 sm:p-6 bg-zinc-900/40 backdrop-blur-sm overflow-hidden">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-xl w-full max-w-xl lg:max-w-2xl flex flex-col max-h-[calc(100vh-2rem)] min-h-0 overflow-hidden">
        <div className="px-6 sm:px-8 py-5 flex items-start justify-between border-b border-zinc-200 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-zinc-900">Create org</h2>
            <p className="text-sm text-zinc-500 mt-0.5">Add a company, brand, project, or agency.</p>
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
        <form onSubmit={handleSubmit} className="px-6 sm:px-8 py-5 lg:py-6 flex flex-col flex-1 min-h-0 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm shrink-0">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6 flex-1 min-h-0">
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
                        org_type === t.value
                          ? "border-primary bg-accent text-primary"
                          : "border-zinc-300 text-zinc-600 hover:bg-zinc-50"
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
                  placeholder="Acme Inc"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => { setSlug(e.target.value); setSlugError(null); setSuggestedSlug(null); }}
                  onBlur={checkSlug}
                  placeholder="acme-inc"
                  className={inputClass}
                />
                <p className="text-xs text-zinc-500 mt-1">URL-friendly, unique. Leave blank to use name.</p>
                {slugChecking && <p className="text-xs text-zinc-500 mt-1">Checking…</p>}
                {slugError && (
                  <p className="text-sm text-destructive mt-1">
                    {slugError}
                    {suggestedSlug && (
                      <>
                        {" "}Try: <button type="button" className="underline font-medium" onClick={() => { setSlug(suggestedSlug); setSlugError(null); setSuggestedSlug(null); }}>{suggestedSlug}</button>
                      </>
                    )}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>Tagline</label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="One line that describes your org"
                  className={inputClass}
                />
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Links</p>
              <div>
                <label className={labelClass}>Website</label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://..."
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>X (Twitter)</label>
                <input
                  type="text"
                  value={twitter_username}
                  onChange={(e) => setTwitterUsername(e.target.value)}
                  placeholder="@handle"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Logo URL <span className="text-zinc-400 font-normal">(optional)</span></label>
                <input
                  type="url"
                  value={logo_url}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-5 pt-5 border-t border-zinc-200 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-300 text-zinc-700 font-medium hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
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
