/**
 * GET /api/x/callback — X OAuth callback. Exchanges code for tokens, stores in x_oauth_tokens, redirects to /xspaces.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const X_CLIENT_ID = process.env.X_CLIENT_ID;
const X_CLIENT_SECRET = process.env.X_CLIENT_SECRET;
const X_OAUTH_COOKIE_SECRET = process.env.X_OAUTH_COOKIE_SECRET;
const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const X_USER_ME = "https://api.twitter.com/2/users/me?user.fields=username";

const COOKIE_NAME = "x_oauth_pending";

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");

  const origin = request.nextUrl.origin;
  const redirectTo = `${origin}/xspaces?x_connected=1`;
  const redirectError = (msg: string) =>
    NextResponse.redirect(`${origin}/xspaces?x_oauth_error=${encodeURIComponent(msg)}`, 302);

  if (errorParam) {
    return redirectError(errorParam === "access_denied" ? "Connection cancelled" : errorParam);
  }
  if (!code || !state || !X_CLIENT_ID || !X_CLIENT_SECRET || !X_OAUTH_COOKIE_SECRET) {
    return redirectError("Missing code or configuration");
  }

  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  if (!cookieValue) {
    return redirectError("Session expired. Try connecting again.");
  }

  const [payloadB64, signature] = cookieValue.split(".");
  if (!payloadB64 || !signature) {
    return redirectError("Invalid callback state");
  }
  const payloadStr = Buffer.from(payloadB64, "base64url").toString("utf8");
  if (signPayload(payloadStr, X_OAUTH_COOKIE_SECRET) !== signature) {
    return redirectError("Invalid callback state");
  }
  let pending: { state: string; profile_id: string; code_verifier: string };
  try {
    pending = JSON.parse(payloadStr);
  } catch {
    return redirectError("Invalid callback state");
  }
  if (pending.state !== state || !pending.profile_id || !pending.code_verifier) {
    return redirectError("Invalid callback state");
  }

  const redirectUri = `${origin}/api/x/callback`;
  const body = new URLSearchParams({
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code_verifier: pending.code_verifier,
  });
  const tokenRes = await fetch(X_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString("base64")}`,
    },
    body: body.toString(),
  });
  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    return redirectError("Token exchange failed");
  }
  const tokenData = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  const accessToken = tokenData.access_token;
  if (!accessToken) {
    return redirectError("No access token returned");
  }

  const meRes = await fetch(X_USER_ME, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  let xUserId: string | null = null;
  let xUsername: string | null = null;
  if (meRes.ok) {
    const meData = (await meRes.json()) as { data?: { id?: string; username?: string } };
    if (meData?.data) {
      xUserId = meData.data.id ?? null;
      xUsername = meData.data.username ?? null;
    }
  }

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null;
  const now = new Date().toISOString();

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { error: upsertErr } = await supabase.from("x_oauth_tokens").upsert(
    {
      profile_id: pending.profile_id,
      provider: "x",
      access_token: accessToken,
      refresh_token: tokenData.refresh_token ?? null,
      expires_at: expiresAt,
      scope: tokenData.scope ?? null,
      x_user_id: xUserId,
      x_username: xUsername,
      updated_at: now,
    },
    { onConflict: "profile_id" }
  );
  if (upsertErr) {
    return redirectError("Failed to store connection");
  }

  const res = NextResponse.redirect(redirectTo, 302);
  res.cookies.delete(COOKIE_NAME);
  return res;
}
