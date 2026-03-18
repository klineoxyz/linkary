/**
 * Shared copy for 429 / RATE_LIMITED API responses ({ resetAt?: string ISO }).
 */
export function formatTryAgainAfter(resetAt: string | null | undefined): string {
  if (!resetAt || typeof resetAt !== "string") {
    return "Please try again in a few minutes.";
  }
  const d = new Date(resetAt);
  if (Number.isNaN(d.getTime())) {
    return "Please try again later.";
  }
  return `Try again after ${d.toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}.`;
}

export function rateLimitFullMessage(prefix: string, resetAt: string | null | undefined): string {
  const tail = formatTryAgainAfter(resetAt);
  return `${prefix.trim().replace(/\.$/, "")}. ${tail}`;
}
