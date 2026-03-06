import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: string;
};

/**
 * Consume one rate limit slot. Uses Postgres consume_rate_limit RPC (atomic).
 * Key patterns: e.g. "post-login-bootstrap:u:userId" or "orgs/create:ip:1.2.3.4"
 */
export async function rateLimit({
  key,
  limit,
  windowSeconds,
  supabaseAdmin,
}: {
  key: string;
  limit: number;
  windowSeconds: number;
  supabaseAdmin: SupabaseClient;
}): Promise<RateLimitResult> {
  const { data, error } = await supabaseAdmin.rpc("consume_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    return { allowed: true, remaining: limit - 1, resetAt: new Date(Date.now() + windowSeconds * 1000).toISOString() };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const allowed = row?.allowed !== false;
  const remaining = typeof row?.remaining === "number" ? Math.max(0, row.remaining) : 0;
  const resetAt =
    typeof row?.reset_at === "string"
      ? row.reset_at
      : new Date(Date.now() + windowSeconds * 1000).toISOString();

  return { allowed, remaining, resetAt };
}

/** Get client IP from request (Vercel x-forwarded-for or x-real-ip). */
export function getClientIp(request: Request): string {
  const v = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "";
  return v.split(",")[0]?.trim() || "unknown";
}

const XSPACES_DETECT_RL_KEY = "rl:xspaces:detect:";
export const XSPACES_DETECT_RL_LIMIT = 10;
const XSPACES_DETECT_WINDOW_SEC = 60;

export type XSpacesDetectRateLimitResult =
  | RateLimitResult
  | (RateLimitResult & { unavailable: true });

/**
 * Rate limit for POST /api/xspaces/detect-my-space: 10 req/min per profile_id.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set;
 * otherwise uses Supabase consume_rate_limit RPC when SUPABASE_SERVICE_ROLE_KEY is set.
 * Returns { unavailable: true } only when both Upstash and Supabase service role are unavailable (no bypass).
 */
export async function rateLimitXSpacesDetect(
  profileId: string,
  supabaseAdmin: SupabaseClient | null
): Promise<XSpacesDetectRateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const hasUpstash = !!(url && token);

  if (hasUpstash) {
    const key = XSPACES_DETECT_RL_KEY + profileId;
    try {
      const incrRes = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      const incrData = (await incrRes.json()) as { result?: number; error?: string };
      if (!incrRes.ok || incrData.error) throw new Error(incrData.error ?? "Upstash error");
      const count = typeof incrData.result === "number" ? incrData.result : 0;
      if (count === 1) {
        await fetch(`${url}/expire/${encodeURIComponent(key)}/${XSPACES_DETECT_WINDOW_SEC}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      const allowed = count <= XSPACES_DETECT_RL_LIMIT;
      const resetAt = new Date(Date.now() + XSPACES_DETECT_WINDOW_SEC * 1000).toISOString();
      return {
        allowed,
        remaining: Math.max(0, XSPACES_DETECT_RL_LIMIT - count),
        resetAt,
      };
    } catch {
      if (supabaseAdmin) {
        try {
          return await rateLimit({
            key: XSPACES_DETECT_RL_KEY + profileId,
            limit: XSPACES_DETECT_RL_LIMIT,
            windowSeconds: XSPACES_DETECT_WINDOW_SEC,
            supabaseAdmin,
          });
        } catch {
          return {
            allowed: false,
            remaining: 0,
            resetAt: new Date().toISOString(),
            unavailable: true,
          };
        }
      }
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date().toISOString(),
        unavailable: true,
      };
    }
  }

  if (supabaseAdmin) {
    return rateLimit({
      key: XSPACES_DETECT_RL_KEY + profileId,
      limit: XSPACES_DETECT_RL_LIMIT,
      windowSeconds: XSPACES_DETECT_WINDOW_SEC,
      supabaseAdmin,
    });
  }

  return {
    allowed: false,
    remaining: 0,
    resetAt: new Date().toISOString(),
    unavailable: true,
  };
}

/** Safe response headers for detect-my-space (observable rate limit). Do not log or expose tokens. */
export function xSpacesDetectRateLimitHeaders(rl: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(XSPACES_DETECT_RL_LIMIT),
    "X-RateLimit-Remaining": String(rl.remaining),
    "X-RateLimit-Reset": rl.resetAt,
  };
}
