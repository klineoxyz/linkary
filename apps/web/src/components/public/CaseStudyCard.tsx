"use client";

import { ExternalLink } from "lucide-react";

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

export type CaseStudyCardProps = {
  id: string;
  title?: string | null;
  summary?: string | null;
  tags?: string[] | null;
  url?: string | null;
  /** Optional image URL (e.g. from proof_file_path or upload). When absent, favicon or initials are used. */
  imageUrl?: string | null;
};

export function CaseStudyCard({
  title,
  summary,
  tags = [],
  url,
  imageUrl,
}: CaseStudyCardProps) {
  const tagList = Array.isArray(tags) ? tags.slice(0, 2) : [];
  const highlight = oneHighlight(summary ?? null, tagList);
  const domain = url?.trim() ? getDomain(url) : "";
  const faviconSrc = domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64` : null;

  return (
    <div className="rounded-xl border border-border bg-card/95 shadow-sm shadow-[inset_0_1px_0_0_hsl(var(--primary)/.06)] transition-all duration-200 hover:border-primary/20 hover:shadow-md hover:shadow-primary/10 p-4 flex items-start gap-3">
      {/* Thumbnail: image > favicon > placeholder with initials */}
      {imageUrl?.trim() ? (
        <img src={imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover border border-border" />
      ) : url?.trim() && faviconSrc ? (
        <img src={faviconSrc} alt="" className="h-12 w-12 shrink-0 rounded-xl border border-border bg-muted/40 object-cover" />
      ) : (
        <div
          className="h-12 w-12 shrink-0 rounded-xl border border-border bg-muted/40 bg-gradient-to-br from-primary/[0.04] to-transparent flex items-center justify-center text-sm font-semibold text-foreground/80"
          aria-hidden
        >
          {initials(title ?? null)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        {title != null && title !== "" && (
          <h3 className="font-semibold text-foreground line-clamp-1">{title}</h3>
        )}
        {highlight != null && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-1">{highlight}</p>
        )}
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
      </div>
    </div>
  );
}
