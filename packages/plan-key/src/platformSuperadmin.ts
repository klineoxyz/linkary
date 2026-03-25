/**
 * Profiles whose `username` or `twitter_username` match (after normalize) get
 * strongest personal plan behavior in app + worker without a subscription row.
 * Add handles here for founder/ops accounts only.
 */
export const PLATFORM_SUPERADMIN_NORMALIZED_HANDLES: readonly string[] = ["muazxinthi"];

/** Lowercase, trim, strip leading @ — matches SQL LOWER(TRIM(BOTH '@' FROM …)). */
export function normalizeProfileHandle(s: string | null | undefined): string {
  if (s == null || typeof s !== "string") return "";
  return s.trim().toLowerCase().replace(/^@/, "");
}

const HANDLE_SET = new Set(PLATFORM_SUPERADMIN_NORMALIZED_HANDLES);

export function profileRowIsPlatformSuperadmin(row: {
  username?: string | null;
  twitter_username?: string | null;
} | null | undefined): boolean {
  const u = normalizeProfileHandle(row?.username);
  const t = normalizeProfileHandle(row?.twitter_username);
  return (u.length > 0 && HANDLE_SET.has(u)) || (t.length > 0 && HANDLE_SET.has(t));
}
