/**
 * GET /api/me/analytics/profile/[username]
 *
 * Cross-user analytics viewer: returns allowlisted analytics for the given profile
 * when the caller is eligible (same entitlement as discovery). Auth required.
 * Rate limited (same policy as discovery). No email, location, pricing, auth ids, or private metadata.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isEligibleForDiscovery } from "@/lib/entitlementDiscovery";
import { rateLimit } from "@/lib/rate-limit";
import { DISCOVERY_RATE_LIMIT, DISCOVERY_RATE_WINDOW_SEC } from "@/lib/discoveryConstants";
import { ok, fail } from "@/lib/api-response";
import { shapeCrossUserAnalyticsResponse } from "@/lib/crossUserAnalyticsAllowlist";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) return fail("UNAUTHORIZED", "Unauthorized", 401);

    const { username: rawUsername } = await params;
    const username = (rawUsername ?? "")
      .trim()
      .replace(/^@/, "")
      .toLowerCase();
    if (!username) return fail("BAD_REQUEST", "username required", 400);

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    let userId: string | null = null;
    let viewerEmail: string | null = null;

    if (token) {
      const bearerClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: { user }, error } = await bearerClient.auth.getUser(token);
      if (!error && user?.id) {
        userId = user.id;
        viewerEmail = user.email ?? null;
      }
    }
    if (!userId) {
      const serverSupabase = await createServerSupabase();
      const { data: { session } } = await serverSupabase.auth.getSession();
      if (session?.user?.id) {
        userId = session.user.id;
        viewerEmail = session.user.email ?? null;
      }
    }
    if (!userId) return fail("UNAUTHORIZED", "Unauthorized", 401);

    const serviceSupabase = createServiceSupabase();

    const eligible = await isEligibleForDiscovery(userId, viewerEmail, serviceSupabase);
    if (!eligible) return fail("ANALYTICS_VIEW_NOT_ELIGIBLE", "Analytics view not available on your plan", 403);

    const rlKey = `analytics-profile:u:${userId}`;
    const rl = await rateLimit({
      key: rlKey,
      limit: DISCOVERY_RATE_LIMIT,
      windowSeconds: DISCOVERY_RATE_WINDOW_SEC,
      supabaseAdmin: serviceSupabase,
    });
    if (!rl.allowed) {
      return fail("RATE_LIMITED", "Too many requests. Try again later.", 429, { resetAt: rl.resetAt });
    }

    const { data: profileRow } = await serviceSupabase
      .from("public_profile_view")
      .select("id, username, display_name, avatar_url")
      .ilike("username", username)
      .maybeSingle();

    if (!profileRow) return fail("NOT_FOUND", "Profile not found", 404);

    const profileId = (profileRow as { id: string }).id;
    if (profileId === userId) {
      return fail("USE_OWN_ANALYTICS", "Use /api/analytics/x for your own analytics", 400);
    }

    const { data: rollup } = await serviceSupabase
      .from("x_analytics_rollups")
      .select(
        "posts_7d, posts_30d, posts_90d, avg_likes_7d, avg_likes_30d, avg_likes_90d, avg_replies_7d, avg_replies_30d, avg_replies_90d, engagement_rate_7d, engagement_rate_30d, engagement_rate_90d, reach_proxy_7d, reach_proxy_30d, reach_proxy_90d"
      )
      .eq("profile_id", profileId)
      .maybeSingle();

    const { profile, analytics } = shapeCrossUserAnalyticsResponse(
      profileRow as { username: string | null; display_name: string | null; avatar_url: string | null },
      username,
      rollup as Record<string, unknown> | null
    );

    return ok({ profile, analytics });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ ok: false as const, code: "SERVER_ERROR", message }, { status: 500 });
  }
}
