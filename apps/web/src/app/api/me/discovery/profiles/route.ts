/**
 * GET /api/me/discovery/profiles
 *
 * Paid discovery: returns discovery-safe profile list for eligible authenticated users only.
 * Contract: only allowlisted fields (see discoveryAllowlist.ts). No email, location, pricing, auth ids.
 * Anonymous requests → 401. Non-eligible users → 403. Discovery stays inside authenticated app surfaces.
 */
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { isEligibleForDiscovery } from "@/lib/entitlementDiscovery";
import { getDiscoveryProfiles } from "@/lib/discoveryService";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

  const eligible = await isEligibleForDiscovery(user.id);
  if (!eligible) {
    return fail("DISCOVERY_NOT_ELIGIBLE", "Discovery access requires an eligible plan", 403);
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 100);
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10) || 0);
  const q = searchParams.get("q")?.trim() ?? undefined;

  try {
    const serviceSupabase = createServiceSupabase();
    const profiles = await getDiscoveryProfiles(serviceSupabase, { limit, offset, q });
    return ok({ profiles });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail("DISCOVERY_ERROR", message, 500);
  }
}
