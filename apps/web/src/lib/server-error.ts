/**
 * Server-only: safe error message for API responses. Never expose tokens, stack traces, or raw payloads.
 */
export function sanitizeServerError(raw: unknown): string {
  if (raw == null) return "Something went wrong.";
  if (typeof raw === "string") {
    const trimmed = raw.trim().slice(0, 200);
    if (/token|password|secret|bearer|authorization|refresh_token|access_token/i.test(trimmed))
      return "Something went wrong.";
    return trimmed || "Something went wrong.";
  }
  if (typeof raw === "object" && "message" in raw && typeof (raw as { message: unknown }).message === "string")
    return sanitizeServerError((raw as { message: string }).message);
  if (typeof raw === "object" && "error" in raw && typeof (raw as { error: unknown }).error === "string")
    return sanitizeServerError((raw as { error: string }).error);
  return "Something went wrong.";
}

const DEBUG_DETECT = process.env.DEBUG_DETECT_MY_SPACE === "1" || process.env.DEBUG_DETECT_MY_SPACE === "true";

/** Safe server-side debug log for detect-my-space. Never logs tokens, headers, or PII. */
export function debugDetect(code: string, detail?: string): void {
  if (!DEBUG_DETECT) return;
  const msg = detail ? `[detect-my-space] ${code}: ${detail}` : `[detect-my-space] ${code}`;
  // eslint-disable-next-line no-console
  console.warn(msg);
}

const DEBUG_SYNC = process.env.DEBUG_SYNC_FROM_X === "1" || process.env.DEBUG_SYNC_FROM_X === "true";

/** Safe server-side debug log for sync-from-x. Never logs tokens, headers, or PII. */
export function debugSync(code: string, detail?: string): void {
  if (!DEBUG_SYNC) return;
  const msg = detail ? `[sync-from-x] ${code}: ${detail}` : `[sync-from-x] ${code}`;
  // eslint-disable-next-line no-console
  console.warn(msg);
}

/** Redact token/secret-like substrings from a response body before logging. Max length 500. */
export function sanitizeResponseBody(body: string): string {
  if (typeof body !== "string") return "";
  let out = body
    .replace(/\bBearer\s+[^\s"']+/gi, "Bearer REDACTED")
    .replace(/"access_token"\s*:\s*"[^"]*"/gi, '"access_token":"REDACTED"')
    .replace(/"refresh_token"\s*:\s*"[^"]*"/gi, '"refresh_token":"REDACTED"')
    .replace(/"authorization"\s*:\s*"[^"]*"/gi, '"authorization":"REDACTED"')
    .trim();
  return out.length > 500 ? out.slice(0, 500) + "..." : out;
}
