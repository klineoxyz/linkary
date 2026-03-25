/**
 * Normalize X/Twitter handles for matching promoted_social_handles to profiles / social_accounts.
 * Keep in sync with apps/worker/src/lib/trackedXHandle.ts.
 */
export function normalizeTrackedXHandle(raw: string): string {
  let s = (raw ?? "").trim().toLowerCase();
  if (!s) return "";
  s = s.replace(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//i, "");
  const slash = s.indexOf("/");
  if (slash >= 0) s = s.slice(0, slash);
  s = s.replace(/^@+/, "");
  const at = s.lastIndexOf("@");
  if (at >= 0) s = s.slice(at + 1);
  s = s.split(/\s+/).join("");
  return s.trim();
}

export function isXPlatform(platform: string): boolean {
  const p = platform.trim().toLowerCase();
  return p === "x" || p === "twitter";
}

/** Stored form: trimmed platform, handle with optional @ stripped for JSONB consistency (UI may add @ back). */
export function normalizePromotedSocialHandlesForStorage(
  entries: { platform: string; handle: string }[]
): { platform: string; handle: string }[] {
  return entries.map((e) => {
    const platform = e.platform.trim().toLowerCase();
    let handle = (e.handle ?? "").trim();
    if (isXPlatform(platform)) {
      handle = normalizeDisplayHandle(handle);
    }
    return { platform, handle };
  });
}

function normalizeDisplayHandle(handle: string): string {
  let h = handle.trim();
  h = h.replace(/^https?:\/\/(www\.)?(x\.com|twitter\.com)\//i, "");
  const slash = h.indexOf("/");
  if (slash >= 0) h = h.slice(0, slash);
  h = h.replace(/^@+/, "");
  h = h.split(/\s+/).join("");
  return h ? `@${h}` : "";
}
