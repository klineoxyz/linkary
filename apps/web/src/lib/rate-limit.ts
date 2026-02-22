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
