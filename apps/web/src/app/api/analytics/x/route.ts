/**
 * GET /api/analytics/x — Contract-locked v2.
 * Always returns JSON: { ok: true, data } or { ok: false, code, message }.
 * Engagement series from x_tweets only (no x_daily_snapshots.engagement_rate).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { isPlanGatingEnabled } from "@/lib/planGating";
import { profileHasCompScope } from "@/lib/opsEntitlementsMerge";
import { effectiveDeepAnalytics } from "@/lib/planCompGate";
import { planKeyFromSubscriptionRow, type PlanKey } from "@/lib/planKey";
import { resolveEffectivePlanKeyForProfile } from "@/lib/subscriptionPlan";
import { shouldGrantDeepAnalyticsBeyondPlan } from "@/lib/analyticsDeepEntitlement";
import { buildXAnalyticsWindowPayloadForProfile } from "@/lib/xAnalyticsPayloadBuild";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function ok(payload: unknown) {
  return NextResponse.json({ ok: true as const, data: payload });
}

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false as const, code, message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return fail("UNAUTHORIZED", "Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url ?? "", "http://localhost");
    const windowRaw = (searchParams.get("window") ?? "30d").toLowerCase();
    const debug = searchParams.get("debug") === "1";

    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    let supabase!: SupabaseClient;
    let userId: string | undefined;
    let auth_mode: "bearer" | "cookie" = "cookie";

    if (bearerToken) {
      const bearerClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${bearerToken}` } },
      });
      const { data: { user }, error: userError } = await bearerClient.auth.getUser(bearerToken);
      if (!userError && user?.id) {
        supabase = bearerClient;
        userId = user.id;
        auth_mode = "bearer";
      }
    }

    if (userId === undefined) {
      const serverSupabase = await createServerSupabase();
      const { data: { session } } = await serverSupabase.auth.getSession();
      if (session?.user?.id) {
        supabase = serverSupabase as SupabaseClient;
        userId = session.user.id;
        auth_mode = "cookie";
      }
    }

    if (!userId) {
      return fail("UNAUTHORIZED", "Unauthorized", 401);
    }

    const { data: authUserData } = await supabase.auth.getUser();
    const userEmail = authUserData?.user?.email ?? null;

    const built = await buildXAnalyticsWindowPayloadForProfile(supabase, userId, windowRaw);
    if (built.ok === false) {
      return fail("SERVER_ERROR", built.message, 500);
    }

    const payload: Record<string, unknown> = { ...built.payload };

    if (debug) {
      payload.debug = {
        auth_mode,
      };
    }

    // Owner analytics: same computed chart_points + kpis for every user; analytics_entitlement marks basic vs full for UI upsell only.
    if (isPlanGatingEnabled()) {
      const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
      let planKey: PlanKey = "free";
      let compDeep = false;
      let serviceClient: ReturnType<typeof createClient> | null = null;
      if (svcKey) {
        serviceClient = createClient(supabaseUrl, svcKey);
        planKey = await resolveEffectivePlanKeyForProfile(serviceClient, userId);
        compDeep = await profileHasCompScope(serviceClient, userId, "analytics_full");
      } else {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("plan_key, tier, status, current_period_end")
          .eq("owner_type", "profile")
          .eq("owner_id", userId)
          .maybeSingle();
        planKey = planKeyFromSubscriptionRow(
          sub as Parameters<typeof planKeyFromSubscriptionRow>[0]
        );
      }
      let allowDeep = effectiveDeepAnalytics(planKey, compDeep ? new Set(["analytics_full"] as const) : undefined);
      if (!allowDeep) {
        const granted = await shouldGrantDeepAnalyticsBeyondPlan({
          userId,
          userEmail,
          service: serviceClient,
          userSupabase: supabase,
        });
        if (granted) {
          allowDeep = true;
        }
      }
      if (!allowDeep) {
        payload.analytics_entitlement = "basic";
      } else {
        payload.analytics_entitlement = "full";
      }
    }

    return ok(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return fail("SERVER_ERROR", message, 500);
  }
}
