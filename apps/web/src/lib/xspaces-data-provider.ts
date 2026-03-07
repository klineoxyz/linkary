/**
 * XSpaces data provider: single abstraction for Space-by-ID and list-by-creator.
 * - Space-by-ID: twitterapi.io when key is set (no user OAuth). No fallback to official X API in this layer.
 * - List-by-creator: remains in x-analytics-server (official X API) — twitterapi.io has no equivalent.
 * Never logs tokens, API keys, or auth headers.
 */
import type { XSpaceDetail } from "@/lib/x-analytics-server";

const TWITTERAPI_BASE = "https://api.twitterapi.io";
const DEFAULT_TIMEOUT_MS = 8000;

export type SpacesProviderCode =
  | "OK"
  | "SPACE_NOT_FOUND"
  | "PROVIDER_NOT_CONFIGURED"
  | "PROVIDER_AUTH_FAILED"
  | "PROVIDER_RATE_LIMITED"
  | "PROVIDER_QUOTA_EXHAUSTED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_INVALID_RESPONSE"
  | "PROVIDER_UNAVAILABLE";

export type SpaceByIdResult =
  | { ok: true; provider: "twitterapi.io"; status: 200; code: "OK"; data: XSpaceDetail; retryable: false }
  | {
      ok: false;
      provider: "twitterapi.io";
      status: number;
      code: SpacesProviderCode;
      data?: undefined;
      retryable: boolean;
      message?: string;
    };

function getProviderApiKey(): string | null {
  const key =
    process.env.TWITTERAPI_IO_KEY?.trim() ||
    process.env.TWITTERAPI_API_KEY?.trim() ||
    null;
  return key;
}

function codeFromStatus(status: number, bodyStatus?: string): Exclude<SpacesProviderCode, "OK"> {
  if (status === 401 || status === 403) return "PROVIDER_AUTH_FAILED";
  if (status === 429) return "PROVIDER_RATE_LIMITED";
  if (status === 404) return "SPACE_NOT_FOUND";
  if (status === 402) return "PROVIDER_QUOTA_EXHAUSTED";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  if (bodyStatus === "error") return "PROVIDER_INVALID_RESPONSE";
  return "PROVIDER_UNAVAILABLE";
}

/**
 * Fetch Space by ID from twitterapi.io only. Uses server-side API key.
 * Returns normalized result. No user OAuth. No fallback to X API.
 * When API key is not set, returns PROVIDER_NOT_CONFIGURED.
 */
export async function fetchSpaceByIdFromTwitterApi(spaceId: string): Promise<
  | SpaceByIdResult
  | { ok: false; provider: null; code: "PROVIDER_NOT_CONFIGURED"; retryable: false; message?: string }
> {
  const id = String(spaceId ?? "").trim();
  if (!id) {
    return { ok: false, provider: "twitterapi.io", status: 0, code: "SPACE_NOT_FOUND", retryable: false };
  }

  const apiKey = getProviderApiKey();
  if (!apiKey) {
    return { ok: false, provider: null, code: "PROVIDER_NOT_CONFIGURED", retryable: false };
  }

  const ac = new AbortController();
  const timeoutId = setTimeout(() => ac.abort(), DEFAULT_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(
      `${TWITTERAPI_BASE}/twitter/spaces/detail?space_id=${encodeURIComponent(id)}`,
      {
        headers: { "X-API-Key": apiKey },
        signal: ac.signal,
        next: { revalidate: 0 },
      }
    );
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = (err as { name?: string }).name === "AbortError";
    return {
      ok: false,
      provider: "twitterapi.io",
      status: 0,
      code: isTimeout ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE",
      retryable: true,
    };
  }
  clearTimeout(timeoutId);

  let bodyText: string;
  try {
    bodyText = await res.text();
  } catch {
    return {
      ok: false,
      provider: "twitterapi.io",
      status: res.status,
      code: "PROVIDER_INVALID_RESPONSE",
      retryable: res.status >= 500,
    };
  }

  let json: { data?: unknown; status?: string; message?: string };
  try {
    json = bodyText ? (JSON.parse(bodyText) as { data?: unknown; status?: string; message?: string }) : {};
  } catch {
    return {
      ok: false,
      provider: "twitterapi.io",
      status: res.status,
      code: "PROVIDER_INVALID_RESPONSE",
      retryable: false,
    };
  }

  if (!res.ok) {
    const code = codeFromStatus(res.status, json?.status);
    return {
      ok: false,
      provider: "twitterapi.io",
      status: res.status,
      code,
      retryable: res.status === 429 || res.status >= 500,
      message: json?.message ?? undefined,
    };
  }

  if (json?.status === "error" || !json?.data) {
    return {
      ok: false,
      provider: "twitterapi.io",
      status: 200,
      code: "PROVIDER_INVALID_RESPONSE",
      retryable: false,
      message: json?.message ?? undefined,
    };
  }

  const data = json.data as XSpaceDetail;
  if (!data?.id) {
    return {
      ok: false,
      provider: "twitterapi.io",
      status: 200,
      code: "SPACE_NOT_FOUND",
      retryable: false,
    };
  }

  return { ok: true, provider: "twitterapi.io", status: 200, code: "OK", data, retryable: false };
}

/**
 * Whether the Spaces-by-ID provider (twitterapi.io) is configured. Use to decide sync-from-x path.
 */
export function isTwitterApiSpacesConfigured(): boolean {
  return getProviderApiKey() != null;
}
