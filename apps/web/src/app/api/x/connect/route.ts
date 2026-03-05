/**
 * POST /api/x/connect — start X OAuth 2.0 (PKCE). Returns { url }; client redirects. Callback stores tokens in x_oauth_tokens.
 * Never fails silently: 503 with code X_OAUTH_NOT_CONFIGURED when env missing; 200 { url } when configured.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const X_AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const COOKIE_NAME = "x_oauth_pending";
const COOKIE_MAX_AGE = 600;

const CONNECT_REQUIRED_ENV = ["X_CLIENT_ID", "X_OAUTH_COOKIE_SECRET"] as const;

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64url");
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const missing = CONNECT_REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: "X OAuth is not configured.",
        code: "X_OAUTH_NOT_CONFIGURED",
        missing: [...missing],
      },
      { status: 503 }
    );
  }

  const X_CLIENT_ID = process.env.X_CLIENT_ID!;
  const X_OAUTH_COOKIE_SECRET = process.env.X_OAUTH_COOKIE_SECRET!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const state = crypto.randomBytes(24).toString("base64url");
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = base64UrlEncode(
    crypto.createHash("sha256").update(codeVerifier).digest()
  );

  const payload = JSON.stringify({
    state,
    profile_id: user.id,
    code_verifier: codeVerifier,
  });
  const signature = signPayload(payload, X_OAUTH_COOKIE_SECRET);
  const cookieValue = Buffer.from(payload, "utf8").toString("base64url") + "." + signature;

  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/x/callback`;
  const scope = "tweet.read users.read space.read offline.access";
  const params = new URLSearchParams({
    response_type: "code",
    client_id: X_CLIENT_ID,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  const url = `${X_AUTH_URL}?${params.toString()}`;

  const res = NextResponse.json({ url }, { status: 200 });
  res.cookies.set(COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}
