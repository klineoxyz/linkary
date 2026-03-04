/**
 * Parse X Space ID from a URL or path string.
 * Supports: x.com/i/spaces/<id>, twitter.com/i/spaces/<id>, query params, trailing slashes.
 * Returns null if parsing fails.
 */
export function parseXSpaceId(inputUrl: string): string | null {
  const trimmed = (inputUrl ?? "").trim();
  if (!trimmed || trimmed.length > 500) return null;
  try {
    const hasProtocol = /^https?:\/\//i.test(trimmed);
    const url = hasProtocol ? trimmed : `https://${trimmed}`;
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host !== "x.com" && host !== "twitter.com" && host !== "www.x.com" && host !== "www.twitter.com") return null;
    const path = parsed.pathname.replace(/\/+$/, "").replace(/^\/+/, "");
    const match = path.match(/^i\/spaces\/([A-Za-z0-9_-]{1,100})/);
    const id = match ? match[1]!.trim() : null;
    return id && id.length >= 1 ? id : null;
  } catch {
    return null;
  }
}
