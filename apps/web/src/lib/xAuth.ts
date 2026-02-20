/**
 * X (Twitter) connection state from DB. Use for "connected" everywhere, not session-only.
 */
import { supabase } from "./supabase";

export type XConnectionRow = {
  id: string;
  user_id: string;
  provider: string;
  provider_user_id: string | null;
  username: string | null;
  status: string;
  revoked_at: string | null;
  connected_at: string;
  updated_at: string;
};

/** Get X connection from DB for current user. Use this to decide "connected" state. */
export async function getXConnection(userId: string): Promise<XConnectionRow | null> {
  const { data, error } = await supabase
    .from("social_accounts")
    .select("id, user_id, provider, provider_user_id, username, status, revoked_at, connected_at, updated_at")
    .eq("user_id", userId)
    .eq("provider", "x")
    .maybeSingle();
  if (error || !data) return null;
  const row = data as XConnectionRow;
  if (row.status !== "connected" || row.revoked_at) return null;
  return row;
}

/** Check if user has X connected (DB truth). */
export async function isXConnected(userId: string): Promise<boolean> {
  const conn = await getXConnection(userId);
  return !!conn;
}

/**
 * Ensure X token is valid. If expired and refresh_token exists, refresh and update social_accounts.
 * Supabase does not expose a generic OAuth refresh for X; if we stored provider_refresh_token
 * we would need to call X's token endpoint. For now we only persist connection state;
 * token refresh can be added when X OAuth refresh flow is implemented.
 */
export async function ensureValidXToken(_userId: string): Promise<{ valid: boolean; error?: string }> {
  return { valid: true };
}
