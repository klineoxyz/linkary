/**
 * Request validation and query guardrails for discovery API.
 * Clamp limit/offset, normalize and cap search term, reject malformed or abusive requests.
 */

export const DISCOVERY_MIN_LIMIT = 1;
export const DISCOVERY_MAX_LIMIT = 100;
export const DISCOVERY_DEFAULT_LIMIT = 20;
export const DISCOVERY_MAX_OFFSET = 10_000;
export const DISCOVERY_QUERY_MAX_LENGTH = 200;

export type ValidatedDiscoveryQuery = {
  limit: number;
  offset: number;
  q: string | undefined;
};

/**
 * Validate and normalize discovery query params.
 * Returns clamped limit/offset and trimmed, length-capped, sanitized q. Never throws.
 */
export function validateDiscoveryQuery(searchParams: URLSearchParams): ValidatedDiscoveryQuery {
  const limitRaw = searchParams.get("limit");
  let limit = typeof limitRaw === "string" ? parseInt(limitRaw, 10) : NaN;
  if (!Number.isFinite(limit) || limit < DISCOVERY_MIN_LIMIT) {
    limit = DISCOVERY_DEFAULT_LIMIT;
  }
  if (limit > DISCOVERY_MAX_LIMIT) {
    limit = DISCOVERY_MAX_LIMIT;
  }

  const offsetRaw = searchParams.get("offset");
  let offset = typeof offsetRaw === "string" ? parseInt(offsetRaw, 10) : NaN;
  if (!Number.isFinite(offset) || offset < 0) {
    offset = 0;
  }
  if (offset > DISCOVERY_MAX_OFFSET) {
    offset = DISCOVERY_MAX_OFFSET;
  }

  let q = searchParams.get("q");
  if (q != null && typeof q === "string") {
    q = q.trim().replace(/\s+/g, " ");
    if (q.length > DISCOVERY_QUERY_MAX_LENGTH) {
      q = q.slice(0, DISCOVERY_QUERY_MAX_LENGTH);
    }
    if (q.length === 0) q = undefined;
    else {
      const sanitized = q.replace(/\*/g, "").replace(/%/g, "");
      if (sanitized.length === 0) q = undefined;
      else q = sanitized;
    }
  } else {
    q = undefined;
  }

  return { limit, offset, q };
}
