/**
 * X (Twitter) connection state. Uses DB + identity truth from xConnection.
 */
import { getMyXConnection, getUserXIdentity } from "./xConnection";
import type { User } from "@supabase/supabase-js";

/** Extract X handle from Supabase auth user. Prefer getUserXIdentity from xConnection for full truth. */
export function getXHandleFromSessionUser(user: unknown): string | null {
  const identity = getUserXIdentity(user as User | null);
  return identity?.username ?? null;
}

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

/** Legacy: get X connection from social_accounts. Prefer getMyXConnection for "is connected" truth. */
export async function getXConnection(userId: string): Promise<XConnectionRow | null> {
  const { supabase } = await import("./supabase"); // dynamic to avoid circular deps if supabase ever imports xAuth
  const { data, error } = await supabase
    .from("social_accounts")
    .select("id, user_id, provider, provider_user_id, username, status, revoked_at, connected_at, updated_at")
    .eq("user_id", userId)
    .in("provider", ["x", "twitter"])
    .maybeSingle();
  if (error || !data) return null;
  const row = data as XConnectionRow;
  if (row.status !== "connected" || row.revoked_at) return null;
  return row;
}

/** Is X connected? Uses single source of truth (identity OR profile OR social_accounts). */
export async function isXConnected(userId: string): Promise<boolean> {
  const status = await getMyXConnection(userId);
  return status.connected;
}

/**
 * Ensure X token is valid. Supabase does not expose generic OAuth refresh for X.
 * For now we only persist connection state.
 */
export async function ensureValidXToken(_userId: string): Promise<{ valid: boolean; error?: string }> {
  return { valid: true };
}
