/**
 * Shared server-side X API (Twitter API v2) fetch helper.
 * Used by my-x-spaces, detect-my-space, sync-from-x. Single place for timeout, body consumption, normalized codes.
 * Never logs tokens, headers, or cookies.
 */
import { sanitizeResponseBody } from "@/lib/server-error";

const DEFAULT_TIMEOUT_MS = 8000;

export type XApiFailureCode =
  | "X_RECONNECT_NEEDED"
  | "X_RATE_LIMITED"
  | "X_CREDITS_DEPLETED"
  | "SPACE_NOT_FOUND"
  | "X_API_TIMEOUT"
  | "INVALID_X_RESPONSE"
  | "X_API_FAILED";

export type XApiResult =
  | { ok: true; status: 200; data: unknown; code: "OK" }
  | {
      ok: false;
      status: number;
      data?: undefined;
      bodyText?: string;
      code: XApiFailureCode;
    };

function codeFromStatus(status: number): XApiFailureCode {
  if (status === 401 || status === 403) return "X_RECONNECT_NEEDED";
  if (status === 429) return "X_RATE_LIMITED";
  if (status === 402) return "X_CREDITS_DEPLETED";
  if (status === 404) return "SPACE_NOT_FOUND";
  return "X_API_FAILED";
}

/**
 * Run a single X API request with Bearer token. Consumes body on !res.ok. Safe JSON parse on 200.
 * Returns normalized result; throws only on AbortError (timeout) so caller can map to X_API_TIMEOUT.
 */
export async function xApiFetch(
  url: string,
  accessToken: string,
  options?: { timeoutMs?: number }
): Promise<XApiResult> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: ac.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
  const bodyText = await res.text().catch(() => "");
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      bodyText: bodyText ? sanitizeResponseBody(bodyText) : undefined,
      code: codeFromStatus(res.status),
    };
  }
  let data: unknown;
  try {
    data = bodyText ? (JSON.parse(bodyText) as unknown) : {};
  } catch {
    return {
      ok: false,
      status: 200,
      bodyText: sanitizeResponseBody(bodyText),
      code: "INVALID_X_RESPONSE",
    };
  }
  return { ok: true, status: 200, data, code: "OK" };
}

/**
 * Call X API and return result. On timeout (AbortError), returns XApiResult with code X_API_TIMEOUT instead of throwing.
 */
export async function xApiFetchSafe(
  url: string,
  accessToken: string,
  options?: { timeoutMs?: number }
): Promise<XApiResult> {
  try {
    return await xApiFetch(url, accessToken, options);
  } catch (err) {
    const isTimeout = (err as { name?: string }).name === "AbortError";
    return {
      ok: false,
      status: 0,
      code: isTimeout ? "X_API_TIMEOUT" : "X_API_FAILED",
    };
  }
}
