/**
 * Deep analytics (full charts payload) beyond paid plan: superadmin, founder profile, or 3-day trial.
 * Trial clock is started server-side via touch_deep_analytics_trial (service role).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { profileRowIsPlatformSuperadmin } from "@linkary/plan-key";

/** @deprecated Use profileRowIsPlatformSuperadmin from @linkary/plan-key */
export const DEEP_ANALYTICS_FOUNDER_USERNAME = "muazxinthi";

function superadminEmailsFromEnv(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * When plan + comp do not already allow deep analytics, grant for:
 * 1) SUPERADMIN_EMAILS env or superadmin_emails table (email match)
 * 2) Profile username === founder handle (normalized)
 * 3) Active 3-day trial (touch_deep_analytics_trial via service role)
 */
export async function shouldGrantDeepAnalyticsBeyondPlan(params: {
  userId: string;
  userEmail: string | null | undefined;
  service: SupabaseClient | null;
  userSupabase: SupabaseClient;
}): Promise<boolean> {
  const email = (params.userEmail ?? "").trim().toLowerCase();
  const envAdmins = superadminEmailsFromEnv();

  if (email && envAdmins.includes(email)) {
    return true;
  }

  if (params.service && email) {
    try {
      const { data: rows } = await params.service.from("superadmin_emails").select("email").limit(500);
      const fromDb = (rows ?? [])
        .map((r: { email?: string }) => (r.email ?? "").toLowerCase().trim())
        .filter(Boolean);
      const set = new Set([...fromDb, ...envAdmins]);
      if (set.size > 0 && set.has(email)) {
        return true;
      }
    } catch {
      /* non-fatal */
    }
  }

  const { data: prof } = await params.userSupabase
    .from("profiles")
    .select("username, twitter_username")
    .eq("id", params.userId)
    .maybeSingle();
  if (profileRowIsPlatformSuperadmin(prof)) {
    return true;
  }

  if (!params.service) {
    return false;
  }

  try {
    const { data: endsAt, error } = await params.service.rpc("touch_deep_analytics_trial", {
      p_profile_id: params.userId,
    });
    if (error || endsAt == null) {
      return false;
    }
    const t = new Date(endsAt as string).getTime();
    return Number.isFinite(t) && t > Date.now();
  } catch {
    return false;
  }
}
