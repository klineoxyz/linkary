/**
 * Phase 4.1: Single twitterapi.io client helper. Server-only.
 * Uses TWITTERAPI_IO_KEY (preferred) or TWITTERAPI_API_KEY. Hard timeouts, 1 retry on 429/5xx.
 */
const BASE = "https://api.twitterapi.io";
const DEFAULT_TIMEOUT_MS = 10_000;
const RETRY_BACKOFF_MS = 1500;

export class TwitterApiError extends Error {
  code?: string;
  status?: number;
  resetAt?: string;
}

function getApiKey(): string | null {
  return (
    process.env.TWITTERAPI_IO_KEY?.trim() ||
    process.env.TWITTERAPI_API_KEY?.trim() ||
    null
  );
}

/**
 * Fetch twitterapi.io with X-API-Key. One retry on 429/5xx with backoff.
 * On 429: throws TwitterApiError with code="RATE_LIMITED" and resetAt if in body/headers.
 * Logs only counts/status, not full payloads.
 */
export async function twitterapiFetch(
  path: string,
  params: Record<string, string>,
  opts?: { timeoutMs?: number }
): Promise<{ ok: true; data: unknown }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new TwitterApiError("TWITTERAPI_IO_KEY not set");
  }

  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}?${new URLSearchParams(params).toString()}`;

  const doFetch = async (): Promise<Response> => {
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { "X-API-Key": apiKey },
        signal: controller.signal,
        next: { revalidate: 0 },
      });
      clearTimeout(to);
      return res;
    } catch (e) {
      clearTimeout(to);
      throw e;
    }
  };

  let res = await doFetch();

  if ((res.status === 429 || res.status >= 500) && res.url) {
    await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
    res = await doFetch();
  }

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? (JSON.parse(text) as unknown) : {};
  } catch {
    const err = new TwitterApiError("Invalid JSON response");
    err.status = res.status;
    throw err;
  }

  if (res.status === 429) {
    const body = data as Record<string, unknown>;
    const err = new TwitterApiError(
      (body.message as string) || body.msg as string || "Rate limited"
    );
    err.code = "RATE_LIMITED";
    err.status = 429;
    const resetAt =
      (body.resetAt as string) ||
      (body.retry_after as string) ||
      res.headers.get("x-rate-limit-reset") ||
      res.headers.get("retry-after");
    if (resetAt) err.resetAt = String(resetAt);
    throw err;
  }

  if (!res.ok) {
    const body = data as Record<string, unknown>;
    const err = new TwitterApiError(
      (body.message as string) || (body.msg as string) || `HTTP ${res.status}`
    );
    err.status = res.status;
    throw err;
  }

  const obj = data as Record<string, unknown>;
  if (obj.status === "error") {
    const err = new TwitterApiError(
      (obj.message as string) || (obj.msg as string) || "API error"
    );
    err.status = res.status;
    throw err;
  }

  return { ok: true as const, data };
}
