/**
 * GET /api/me/analytics/profile/[username]
 *
 * Cross-user analytics viewer: returns allowlisted analytics for the given profile
 * when the caller is eligible (same entitlement as discovery). Auth required.
 * No email, location, pricing, auth ids, or private metadata.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isEligibleForDiscovery } from "@/lib/entitlementDiscovery";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false as const, code, message }, { status });
}

function ok(payload: unknown) {
  return NextResponse.json({ ok: true as const, ...payload });
}

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

    const profile = {
      username: (profileRow as { username: string | null }).username ?? username,
      display_name: (profileRow as { display_name: string | null }).display_name ?? null,
      avatar_url: (profileRow as { avatar_url: string | null }).avatar_url ?? null,
    };

    const analytics = rollup
      ? {
          posts_7d: (rollup as Record<string, unknown>).posts_7d ?? null,
          posts_30d: (rollup as Record<string, unknown>).posts_30d ?? null,
          posts_90d: (rollup as Record<string, unknown>).posts_90d ?? null,
          avg_likes_30d: (rollup as Record<string, unknown>).avg_likes_30d ?? null,
          avg_replies_30d: (rollup as Record<string, unknown>).avg_replies_30d ?? null,
          engagement_rate_30d: (rollup as Record<string, unknown>).engagement_rate_30d ?? null,
          reach_proxy_30d: (rollup as Record<string, unknown>).reach_proxy_30d ?? null,
        }
      : null;

    return ok({ profile, analytics });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return fail("SERVER_ERROR", message, 500);
  }
}
