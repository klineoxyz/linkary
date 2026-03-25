/**
 * Normalize X/Twitter handles (ingestion + CRM). Keep aligned with apps/crm/src/lib/trackedXHandle.ts.
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
