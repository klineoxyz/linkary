/**
 * GET /api/me/discovery/profiles
 *
 * Paid discovery: returns discovery-safe profile list for eligible authenticated users only.
 * Contract: only allowlisted fields (see discoveryAllowlist.ts). No email, location, pricing, auth ids.
 * Anonymous → 401. Non-eligible → 403. Rate limited. Validated query params. Audit logged.
 */
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { checkDiscoveryEligibility } from "@/lib/entitlementDiscovery";
import { getDiscoveryProfiles } from "@/lib/discoveryService";
import { validateDiscoveryQuery } from "@/lib/discoveryValidation";
import { shapeDiscoveryProfilesResponse } from "@/lib/discoveryResponseShape";
import { logDiscoveryAccess } from "@/lib/discoveryAuditLog";
import { rateLimit } from "@/lib/rate-limit";
import { DISCOVERY_RATE_LIMIT, DISCOVERY_RATE_WINDOW_SEC } from "@/lib/discoveryConstants";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const ENDPOINT = "/api/me/discovery/profiles";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  let serviceSupabase: ReturnType<typeof createServiceSupabase> | null = null;
  try {
    serviceSupabase = createServiceSupabase();
  } catch {
    /* no service key; entitlement will use env-only layers */
  }

  const outcome = await checkDiscoveryEligibility(user.id, user.email ?? null, serviceSupabase);
  if (!outcome.eligible) {
    if (serviceSupabase) {
      logDiscoveryAccess(serviceSupabase, {
        user_id: user.id,
        endpoint: ENDPOINT,
        has_query: false,
        result_count: 0,
        outcome: "forbidden",
      }).catch(() => {});
    }
    return fail("DISCOVERY_NOT_ELIGIBLE", "Discovery access requires an eligible plan", 403);
  }

  if (serviceSupabase) {
    const rlKey = `discovery:u:${user.id}`;
    const rl = await rateLimit({
      key: rlKey,
      limit: DISCOVERY_RATE_LIMIT,
      windowSeconds: DISCOVERY_RATE_WINDOW_SEC,
      supabaseAdmin: serviceSupabase,
    });
    if (!rl.allowed) {
      logDiscoveryAccess(serviceSupabase, {
        user_id: user.id,
        endpoint: ENDPOINT,
        has_query: false,
        result_count: 0,
        outcome: "rate_limited",
      }).catch(() => {});
      return fail("RATE_LIMITED", "Too many discovery requests. Try again later.", 429, {
        resetAt: rl.resetAt,
      });
    }
  }

  if (!serviceSupabase) {
    return fail("DISCOVERY_UNAVAILABLE", "Service unavailable", 503);
  }

  const validated = validateDiscoveryQuery(new URL(request.url).searchParams);

  try {
    const profiles = await getDiscoveryProfiles(serviceSupabase, {
      limit: validated.limit,
      offset: validated.offset,
      q: validated.q,
    });
    const shaped = shapeDiscoveryProfilesResponse(profiles);
    logDiscoveryAccess(serviceSupabase, {
      user_id: user.id,
      endpoint: ENDPOINT,
      has_query: !!validated.q,
      result_count: shaped.length,
      outcome: "success",
    }).catch(() => {});
    return ok({ profiles: shaped });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (serviceSupabase) {
      logDiscoveryAccess(serviceSupabase, {
        user_id: user.id,
        endpoint: ENDPOINT,
        has_query: !!validated.q,
        result_count: 0,
        outcome: "error",
      }).catch(() => {});
    }
    return fail("DISCOVERY_ERROR", message, 500);
  }
}
