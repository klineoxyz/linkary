/**
 * Returns true if the URL is a Supabase (or similar) private storage URL.
 * Such URLs must never be rendered in img src; use signed URLs or placeholder instead.
 * Uses NEXT_PUBLIC_SUPABASE_URL when set (supports custom domains); falls back to generic path detection.
 */
const SUPABASE_BASE = ((): string => {
  if (typeof process === "undefined" || !process.env?.NEXT_PUBLIC_SUPABASE_URL) return "";
  return String(process.env.NEXT_PUBLIC_SUPABASE_URL).trim().replace(/\/$/, "");
})();

function normalizedStoragePrefix(base: string): string {
  const b = base.toLowerCase();
  return b ? `${b}/storage/` : "";
}

export function isPrivateStorageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") return false;
  const u = url.trim();
  if (!u) return false;

  // Primary: configured project URL (works with custom domains)
  const prefix = normalizedStoragePrefix(SUPABASE_BASE);
  if (prefix) {
    const uLower = u.toLowerCase();
    if (uLower.startsWith(prefix)) return true; // covers /storage/, /storage/v1/, /storage/v1/object/, etc.
  }

  // Fallback: generic storage path (when env missing; no hardcoded supabase.co)
  try {
    const parsed = new URL(u, "https://dummy");
    const path = parsed.pathname;
    if (path.includes("/storage/v1/") || path.startsWith("/storage/") || path.includes("/object/")) {
      return true;
    }
  } catch {
    if (u.includes("/storage/v1/") || u.includes("/storage/") || u.includes("/object/")) {
      return true;
    }
  }

  // Last-resort only: legacy supabase.co storage (env missing and URL unusual)
  const uLower = u.toLowerCase();
  if (uLower.includes("supabase.co") && (uLower.includes("/storage/") || uLower.includes("/object/"))) {
    return true;
  }

  return false;
}
