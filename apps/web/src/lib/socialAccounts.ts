/**
 * Social accounts: single source of truth for "X connected" in UI.
 * Join key: social_accounts.user_id === auth.uid() (profiles.id in our system).
 * Do NOT use owner_profile_id or profile_id; this table has user_id only.
 */
import { supabase } from "./supabase";

export type SocialAccountX = {
  connected: boolean;
  username: string | null;
  provider_user_id: string | null;
};

/**
 * Get active X connection from social_accounts.
 * Prefer RPC get_my_social_x (SECURITY DEFINER) so we get the row even when table RLS/session timing would block; then fall back to direct table select.
 */
export async function getMySocialAccountX(userId: string): Promise<SocialAccountX> {
  const empty: SocialAccountX = { connected: false, username: null, provider_user_id: null };

  const { data: rpcRows, error: rpcError } = await supabase.rpc("get_my_social_x");
  if (!rpcError && Array.isArray(rpcRows) && rpcRows.length > 0) {
    const r = rpcRows[0] as { connected?: boolean; username?: string | null; provider_user_id?: string | null };
    const connected = !!r?.connected;
    return {
      connected,
      username: connected && r?.username ? String(r.username).replace(/^@/, "").trim() : null,
      provider_user_id: connected && r?.provider_user_id ? String(r.provider_user_id).trim() : null,
    };
  }

  const { data: rows, error } = await supabase
    .from("social_accounts")
    .select("username, provider_user_id, revoked_at, status")
    .eq("user_id", userId)
    .in("provider", ["x", "twitter"])
    .is("revoked_at", null)
    .order("connected_at", { ascending: false })
    .limit(1);

  if (error || !rows?.length) return empty;

  const row = rows[0] as { username?: string | null; provider_user_id?: string | null; revoked_at?: string | null; status?: string };
  const active = row.status === "connected";
  return {
    connected: !!active,
    username: active && row.username ? String(row.username).replace(/^@/, "").trim() : null,
    provider_user_id: active && row.provider_user_id ? String(row.provider_user_id).trim() : null,
  };
}
