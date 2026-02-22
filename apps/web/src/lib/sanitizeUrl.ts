/**
 * Sanitize URLs for public DTO. Allow only http/https. Reject javascript:, data:, file:, etc.
 * Returns null if invalid or unsafe.
 */
export function sanitizeUrl(value: string | null | undefined): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("file:") ||
    lower.startsWith("vbscript:") ||
    lower.startsWith("blob:")
  ) {
    return null;
  }
  if (lower.startsWith("https://") || lower.startsWith("http://")) {
    return raw;
  }
  return null;
}
