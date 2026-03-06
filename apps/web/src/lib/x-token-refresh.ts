/**
 * Server-only: refresh X (Twitter) OAuth access token using stored refresh_token.
 * Used when X API returns 401/403; one refresh attempt then retry. Never logs tokens.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";

export type RefreshResult = { access_token: string; expires_at: string | null } | null;

/**
 * If profile has a valid refresh_token, call X token endpoint, update x_oauth_tokens, return new access_token.
 * Returns null if no refresh_token, refresh fails, or env missing. Caller must use service-role Supabase to read/update x_oauth_tokens.
 */
export async function refreshXAccessToken(
  profileId: string,
  supabase: SupabaseClient
): Promise<RefreshResult> {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const { data: row, error: selectErr } = await supabase
    .from("x_oauth_tokens")
    .select("refresh_token")
    .eq("profile_id", profileId)
    .eq("provider", "x")
    .maybeSingle();
  if (selectErr || !row) return null;
  const refreshToken = (row as { refresh_token?: string | null }).refresh_token;
  if (!refreshToken || typeof refreshToken !== "string" || !refreshToken.trim()) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: body.toString(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  let tokenData: { access_token?: string; refresh_token?: string; expires_in?: number };
  try {
    tokenData = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  } catch {
    return null;
  }
  const newAccessToken = tokenData.access_token;
  if (!newAccessToken || typeof newAccessToken !== "string") return null;

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;
  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    access_token: newAccessToken,
    updated_at: now,
  };
  if (expiresAt != null) updatePayload.expires_at = expiresAt;
  if (tokenData.refresh_token != null) updatePayload.refresh_token = tokenData.refresh_token;

  const { error: updateErr } = await supabase
    .from("x_oauth_tokens")
    .update(updatePayload)
    .eq("profile_id", profileId)
    .eq("provider", "x");
  if (updateErr) return null;

  return { access_token: newAccessToken, expires_at: expiresAt };
}
