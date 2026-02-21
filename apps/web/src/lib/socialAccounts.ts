/**
 * Social accounts: single source of truth for "X connected" in UI.
 * Do NOT use auth identities; use this + profile mirror only.
 */
import { supabase } from "./supabase";

export type SocialAccountX = {
  connected: boolean;
  username: string | null;
  provider_user_id: string | null;
};

/**
 * Get active X connection from social_accounts only (revoked_at IS NULL).
 * Use this for Integrations "connected" state; prefer provider_user_id for twitterapi.io (handles can change).
 */
export async function getMySocialAccountX(userId: string): Promise<SocialAccountX> {
  const { data, error } = await supabase
    .from("social_accounts")
    .select("username, provider_user_id, revoked_at, status")
    .eq("user_id", userId)
    .eq("provider", "x")
    .maybeSingle();

  if (error || !data) {
    return { connected: false, username: null, provider_user_id: null };
  }

  const row = data as { username?: string | null; provider_user_id?: string | null; revoked_at?: string | null; status?: string };
  const active = !row.revoked_at && row.status === "connected";

  return {
    connected: !!active,
    username: active && row.username ? String(row.username).replace(/^@/, "").trim() : null,
    provider_user_id: active && row.provider_user_id ? String(row.provider_user_id).trim() : null,
  };
}
