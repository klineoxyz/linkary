import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { planKeyFromSubscriptionRow } from "@/lib/planKey";
import { profileRowIsPlatformSuperadmin } from "@linkary/plan-key";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ALLOWED_EVENTS = new Set<string>([
  "auth_signed_in",
  "profile_viewed",
  "profile_completed",
  "profile_published_or_saved",
  "x_connect_started",
  "x_connect_completed",
  "analytics_opened",
  "analytics_refresh_requested",
  "marketplace_opened",
  "campaign_list_opened",
  "campaign_created",
  "campaign_create_opened",
  "campaign_launched",
  "campaign_finalized",
  "report_opened",
  "case_study_opened",
  "ops_action_used",
]);

type ProfileCtx = {
  profile_type?: string | null;
  account_type?: string | null;
  twitter_username?: string | null;
  twitter_user_id?: string | null;
  x_connected?: boolean | null;
  username?: string | null;
};

function deriveUserType(profile: ProfileCtx | null): string {
  if (profileRowIsPlatformSuperadmin(profile)) return "superadmin";
  const accountType = (profile?.account_type ?? "").toLowerCase();
  const profileType = (profile?.profile_type ?? "").toLowerCase();
  if (accountType === "company" || profileType === "company" || profileType === "project") return "org";
  return "creator";
}

export async function POST(request: NextRequest) {
  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return NextResponse.json({ ok: true });

    let body: { event_name?: string; properties?: Record<string, unknown> } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ ok: true });
    }
    const event_name = String(body.event_name ?? "").trim();
    if (!ALLOWED_EVENTS.has(event_name)) return NextResponse.json({ ok: true });

    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    let userId: string | null = null;
    let userSupabase: any = null;

    if (bearerToken) {
      const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${bearerToken}` } },
      });
      const { data } = await c.auth.getUser(bearerToken);
      if (data?.user?.id) {
        userId = data.user.id;
        userSupabase = c;
      }
    }

    if (!userId) {
      const serverSupabase = await createServerSupabase();
      const {
        data: { session },
      } = await serverSupabase.auth.getSession();
      if (!session?.user?.id) return NextResponse.json({ ok: true });
      userId = session.user.id;
      userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${session.access_token}` } },
      });
    }

    const [profileRes, subRes] = await Promise.all([
      userSupabase
        .from("profiles")
        .select("profile_type, account_type, twitter_username, twitter_user_id, x_connected, username")
        .eq("id", userId)
        .maybeSingle(),
      userSupabase
        .from("subscriptions")
        .select("plan_key, tier, status, current_period_end")
        .eq("owner_type", "profile")
        .eq("owner_id", userId)
        .maybeSingle(),
    ]);

    const profile = (profileRes.data as ProfileCtx | null) ?? null;
    const hasProfile = !!profile;
    const xConnected = !!(profile?.x_connected || profile?.twitter_user_id || profile?.twitter_username);
    const effectivePlan = planKeyFromSubscriptionRow(
      (subRes.data as Parameters<typeof planKeyFromSubscriptionRow>[0]) ?? null
    );

    const properties = body.properties && typeof body.properties === "object" ? body.properties : {};

    await (userSupabase as any).from("product_events").insert({
      source_app: "web",
      event_name,
      user_id: userId,
      user_type: deriveUserType(profile),
      effective_plan: effectivePlan,
      x_connected: xConnected,
      has_profile: hasProfile,
      properties,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

