import type { SupabaseClient } from "@supabase/supabase-js";
import { planKeyFromSubscriptionRow } from "@/lib/planKey";
import { profileRowIsPlatformSuperadmin } from "@linkary/plan-key";

export type ProductEventName =
  | "auth_signed_in"
  | "profile_viewed"
  | "profile_completed"
  | "profile_published_or_saved"
  | "x_connect_started"
  | "x_connect_completed"
  | "analytics_opened"
  | "analytics_refresh_requested"
  | "marketplace_opened"
  | "campaign_list_opened"
  | "campaign_created"
  | "campaign_create_opened"
  | "campaign_launched"
  | "campaign_finalized"
  | "report_opened"
  | "case_study_opened"
  | "ops_action_used";

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

export async function recordProductEvent(
  supabase: SupabaseClient,
  userId: string,
  event_name: ProductEventName,
  source_app: "web" | "crm" = "crm",
  properties?: Record<string, unknown>
): Promise<void> {
  try {
    const [profileRes, subRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("profile_type, account_type, twitter_username, twitter_user_id, x_connected, username")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("plan_key, tier, status, current_period_end")
        .eq("owner_type", "profile")
        .eq("owner_id", userId)
        .maybeSingle(),
    ]);

    const profile = (profileRes.data as ProfileCtx | null) ?? null;
    const xConnected = !!(profile?.x_connected || profile?.twitter_user_id || profile?.twitter_username);
    const effectivePlan = planKeyFromSubscriptionRow(
      (subRes.data as Parameters<typeof planKeyFromSubscriptionRow>[0]) ?? null
    );

    await supabase.from("product_events").insert({
      source_app,
      event_name,
      user_id: userId,
      user_type: deriveUserType(profile),
      effective_plan: effectivePlan,
      x_connected: xConnected,
      has_profile: !!profile,
      properties: properties ?? {},
    });
  } catch {
    // best-effort only
  }
}

