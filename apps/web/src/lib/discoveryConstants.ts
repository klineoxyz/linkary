/**
 * Discovery API constants for production hardening.
 * Single place for rate limit policy and related config.
 *
 * Rate limit policy (controlled beta):
 * - Per authenticated user (key: discovery:u:{userId}).
 * - 60 requests per 60 seconds per user.
 * - When exceeded: 429 with resetAt; audit outcome "rate_limited".
 * - Implemented via Supabase consume_rate_limit RPC (see rate-limit.ts).
 */

export const DISCOVERY_RATE_LIMIT = 60;
export const DISCOVERY_RATE_WINDOW_SEC = 60;
