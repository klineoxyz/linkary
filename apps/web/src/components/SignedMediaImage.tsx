"use client";

import { useEffect, useState } from "react";

/**
 * Renders an image from private storage via GET /api/media/signed-url.
 * Use whenever displaying media from file_path; do not use direct storage URLs.
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
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path?.trim()) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    (async () => {
      const headers = await getAuthHeaders();
      const res = await fetch(`${base}/api/media/signed-url?path=${encodeURIComponent(path)}`, { headers });
      const data = await res.json().catch(() => ({}));
      if (!cancelled && data?.url) setUrl(data.url);
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (!url) return null;
  return <img src={url} alt={alt} className={className} />;
}
