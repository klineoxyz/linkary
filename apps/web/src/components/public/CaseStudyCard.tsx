"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

/** Domain for favicon URL; safe for any string. */
function getDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname;
  } catch {
    return "";
  }
}

/** Initials from title (max 2 chars). */
function initials(title: string | null | undefined): string {
  if (!title?.trim()) return "?";
  const parts = title.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
  return title.slice(0, 2).toUpperCase();
}

/** One highlight line from summary or top tag. */
function oneHighlight(summary: string | null | undefined, tags: string[]): string | null {
  if (summary?.trim()) {
    const first = summary.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)[0];
    if (first) return first.length > 120 ? first.slice(0, 117) + "…" : first;
  }
  if (tags.length > 0) return tags[0];
  return null;
}

const initialsPlaceholderClass =
  "h-12 w-12 shrink-0 rounded-xl border border-border bg-muted/40 bg-gradient-to-br from-primary/[0.04] to-transparent flex items-center justify-center text-sm font-semibold text-foreground/80";

export type CaseStudyCardProps = {
  id: string;
  title?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  url?: string | null;
  /** Optional image URL (from proof_file_path signed URL). When absent or on load error, favicon or initials are used. */
  imageUrl?: string | null;
  /** When true, show "From verified work" indicator (public profile only; no internal ids). */
  fromVerifiedWork?: boolean;
  /** Optional top-right actions (e.g. Edit/Delete on edit page). */
  actions?: React.ReactNode;
  /** Optional metrics/details for expandable "Details" section (collapsed by default). Only shown when present and has entries. */
  details?: Record<string, unknown> | null;
};

export function CaseStudyCard({
  title,
  summary,
  tags = [],
  url,
  imageUrl,
  fromVerifiedWork,
  actions,
  details,
}: CaseStudyCardProps) {
  const [imageError, setImageError] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const tagList = Array.isArray(tags) ? tags.slice(0, 2) : [];
  const highlight = oneHighlight(summary ?? null, tagList);
  const domain = url?.trim() ? getDomain(url) : "";
  const faviconSrc = domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : null;

  const showImage = imageUrl?.trim() && !imageError;
  const showFavicon = !showImage && url?.trim() && faviconSrc && !faviconError;
  const showInitials = !showImage && !showFavicon;

  const detailsEntries =
    details && typeof details === "object" && !Array.isArray(details)
      ? Object.entries(details).filter(([, v]) => v != null && v !== "")
      : [];
  const hasDetails = detailsEntries.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card/95 shadow-sm shadow-[inset_0_1px_0_0_hsl(var(--primary)/.06)] transition-all duration-200 hover:border-primary/20 hover:shadow-md hover:shadow-primary/10 p-4 flex items-start gap-3">
      {/* Thumbnail: image > favicon > placeholder with initials; onError falls back to initials */}
      {showImage && (
        <img
          src={imageUrl!}
          alt=""
          className="h-12 w-12 shrink-0 rounded-xl object-cover border border-border"
          onError={() => setImageError(true)}
        />
      )}
      {showFavicon && (
        <img
          src={faviconSrc}
          alt=""
          className="h-12 w-12 shrink-0 rounded-xl border border-border bg-muted/40 object-cover"
          onError={() => setFaviconError(true)}
        />
      )}
      {showInitials && (
        <div className={initialsPlaceholderClass} aria-hidden>
          {initials(title ?? null)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {title != null && title !== "" && (
                <h3 className="font-semibold text-foreground line-clamp-1">{title}</h3>
              )}
              {fromVerifiedWork && (
                <span className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary shrink-0" aria-label="From verified work">
                  From verified work
                </span>
              )}
            </div>
            {highlight != null && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{highlight}</p>
            )}
          </div>
          {actions != null && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </div>
        {tagList.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {tagList.map((t) => (
              <span key={t} className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs font-medium text-foreground">
                {t}
              </span>
            ))}
          </div>
        )}
        {url?.trim() && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            View <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        {hasDetails && (
          <div className="mt-3 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setDetailsOpen((o) => !o)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              {detailsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              Details
            </button>
            {detailsOpen && (
              <dl className="mt-2 space-y-1 text-xs">
                {detailsEntries.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-muted-foreground capitalize">{k.replace(/_/g, " ")}</dt>
                    <dd className="text-foreground font-medium truncate">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
