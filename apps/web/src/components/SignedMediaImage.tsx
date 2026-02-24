"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const CACHE_TTL_MS = 45_000; // 45s max; API URLs are 60s so we refresh before expiry
const NEAR_EXPIRY_MS = 10_000; // refresh if less than 10s remaining
type CacheEntry = { url: string; expiresAt: number };
const urlCache = new Map<string, CacheEntry>();

function getCachedUrl(path: string): string | null {
  const entry = urlCache.get(path);
  if (!entry) return null;
  const now = Date.now();
  if (now >= entry.expiresAt - NEAR_EXPIRY_MS) return null; // expired or near expiry
  return entry.url;
}

function setCachedUrl(path: string, url: string): void {
  urlCache.set(path, { url, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * Renders an image from private storage via GET /api/media/signed-url.
 * Use whenever displaying media from file_path; do not use direct storage URLs.
 * - In-memory cache (45s TTL, refresh if <10s remaining).
 * - On img error: refetch signed URL once (max 1 retry).
 * - On fetch failure: fallback placeholder only; never raw storage URL.
 */
export function SignedMediaImage({
  path,
  getAuthHeaders,
  alt = "",
  className,
}: {
  path: string;
  getAuthHeaders: () => Promise<Record<string, string>>;
  alt?: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(() => (path?.trim() ? getCachedUrl(path) : null));
  const [fetchFailed, setFetchFailed] = useState(false);
  const retriedRef = useRef(false);

  const fetchUrl = useCallback(
    async (pathToFetch: string, useCache: boolean) => {
      if (!pathToFetch?.trim()) return null;
      if (useCache) {
        const cached = getCachedUrl(pathToFetch);
        if (cached) return cached;
      }
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${base}/api/media/signed-url?path=${encodeURIComponent(pathToFetch)}`,
        { headers }
      );
      const data = await res.json().catch(() => ({}));
      const signedUrl = data?.url ?? null;
      if (signedUrl) setCachedUrl(pathToFetch, signedUrl);
      return signedUrl;
    },
    [getAuthHeaders]
  );

  useEffect(() => {
    if (!path?.trim()) {
      setUrl(null);
      setFetchFailed(false);
      retriedRef.current = false;
      return;
    }
    let cancelled = false;
    setFetchFailed(false);
    retriedRef.current = false;
    (async () => {
      const u = await fetchUrl(path, true);
      if (!cancelled && u) setUrl(u);
      else if (!cancelled && !u) setFetchFailed(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [path, fetchUrl]);

  const handleError = useCallback(() => {
    if (!path?.trim() || retriedRef.current) {
      setFetchFailed(true);
      return;
    }
    retriedRef.current = true;
    (async () => {
      const u = await fetchUrl(path, false);
      if (u) setUrl(u);
      else setFetchFailed(true);
    })();
  }, [path, fetchUrl]);

  if (fetchFailed || (!url && !path?.trim())) {
    return (
      <div
        className={className}
        style={{ minWidth: 24, minHeight: 24, background: "var(--sidebar-accent, #f4f4f5)", borderRadius: 4 }}
        aria-label={alt || "Image unavailable"}
        role="img"
      />
    );
  }

  if (!url) return null;

  return <img src={url} alt={alt} className={className} onError={handleError} />;
}
